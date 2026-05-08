import {
    Item,
    PreviewDuplicateCandidate,
    PreviewItemMasterDraft,
    PreviewItemRequest,
    PreviewPurchasePriceDraft,
    PreviewSellPriceDraft,
    PreviewValidationSummary,
    SupplierProductMap,
    SupplierStockSnapshot
} from '../types';
import { normalizeItemCode } from './normalization';

export interface MdSkuInput {
    purchaseEnabled: boolean;
    saleEnabled: boolean;
    rfidFlag: boolean;
    category?: string;
    productType?: string;
    size?: string;
    variety?: string;
    colour?: string;
    gsm?: string;
    cogFlag?: boolean;
    businessUnit?: string;
}

const cleanSegment = (value: string, fallback = '') =>
    (value || fallback).toUpperCase().replace(/[^A-Z0-9]/g, '');

const codeFromValue = (value: string | undefined, known: Record<string, string>, fallbackLength = 2) => {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (known[normalized]) return known[normalized];
    const initials = normalized
        .split(/\s+|\/|-|_/)
        .filter(Boolean)
        .map(part => part[0])
        .join('');
    return cleanSegment(initials || normalized, '').slice(0, fallbackLength);
};

const CATEGORY_CODES: Record<string, string> = {
    healthcare: 'H',
    accommodation: 'A',
    linenhub: 'LH',
    'linen hub': 'LH',
    'customer own goods': 'CG',
    cog: 'CG',
    'daily hire': 'DH',
    traditional: 'T'
};

const PRODUCT_TYPE_CODES: Record<string, string> = {
    sheet: 'SH',
    sheets: 'SH',
    'bath towel': 'BT',
    towel: 'TW',
    'sleeping bag': 'SB',
    hood: 'HD',
    blanket: 'BL',
    pillowcase: 'PC',
    robe: 'RB',
    gown: 'GW'
};

const SIZE_CODES: Record<string, string> = {
    queen: 'Q',
    king: 'K',
    single: 'S',
    double: 'D',
    small: '01',
    medium: '02',
    large: '03',
    xl: '04',
    '2xl': '05',
    '3xl': '06',
    '4xl': '07',
    xs: '0X',
    xxs: '02X'
};

const COLOUR_CODES: Record<string, string> = {
    white: 'W',
    blue: 'B',
    black: 'BK',
    green: 'G',
    grey: 'GY',
    gray: 'GY',
    red: 'R',
    yellow: 'Y',
    navy: 'N'
};

export const generateMdSku = (input: MdSkuInput): string => {
    const itemType = input.saleEnabled ? 'S' : 'P';
    const rfid = input.rfidFlag ? 'R' : 'L';
    const category = input.cogFlag
        ? 'CG'
        : codeFromValue(input.category || input.businessUnit, CATEGORY_CODES, 2) || 'X';
    const productType = codeFromValue(input.productType, PRODUCT_TYPE_CODES, 2) || 'XX';
    const size = codeFromValue(input.size, SIZE_CODES, 2) || '0';
    const variety = cleanSegment(input.variety || '01').slice(0, 3) || '01';
    const colour = codeFromValue(input.colour, COLOUR_CODES, 2);
    const gsm = cleanSegment(input.gsm || '').slice(0, 4);

    return cleanSegment(`${itemType}${rfid}${category}${productType}${size}${variety}${colour}${gsm}`);
};

export const validatePreviewSku = (
    sku: string,
    liveItems: Item[],
    previewRequests: PreviewItemRequest[],
    currentRequestId?: string
): PreviewValidationSummary & { collisionSources: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const collisionSources: string[] = [];
    const normalizedSku = cleanSegment(sku);

    if (!normalizedSku) errors.push('SKU is required.');
    if (sku !== normalizedSku) errors.push('SKU must use uppercase alphanumeric characters only.');

    const liveCollision = liveItems.find(item => normalizeItemCode(item.sku).normalized === normalizedSku);
    if (liveCollision) {
        errors.push(`SKU already exists in live items: ${liveCollision.name}.`);
        collisionSources.push(`LIVE_ITEM:${liveCollision.id}`);
    }

    previewRequests.forEach(request => {
        if (request.id === currentRequestId) return;
        const draftSku = String((request.draftPayload?.proposedSku || '') as string);
        if (normalizeItemCode(draftSku).normalized === normalizedSku) {
            errors.push(`SKU already exists in preview request ${request.requestNumber}.`);
            collisionSources.push(`PREVIEW_REQUEST:${request.id}`);
        }
    });

    if (normalizedSku.length < 6) warnings.push('Generated SKU is short; confirm reference codes are complete.');

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        collisionSources
    };
};

const tokenSet = (value: string | undefined) =>
    new Set((value || '').toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 1));

const jaccardScore = (a: string | undefined, b: string | undefined) => {
    const aTokens = tokenSet(a);
    const bTokens = tokenSet(b);
    if (aTokens.size === 0 || bTokens.size === 0) return 0;
    let intersection = 0;
    aTokens.forEach(token => {
        if (bTokens.has(token)) intersection++;
    });
    const union = new Set([...aTokens, ...bTokens]).size;
    return union === 0 ? 0 : intersection / union;
};

export const findPreviewDuplicateCandidates = (
    request: PreviewItemRequest,
    masterDraft: PreviewItemMasterDraft,
    liveItems: Item[],
    previewRequests: PreviewItemRequest[],
    mappings: SupplierProductMap[],
    stockSnapshots: SupplierStockSnapshot[]
): PreviewDuplicateCandidate[] => {
    const candidates: PreviewDuplicateCandidate[] = [];
    const proposedSku = normalizeItemCode(masterDraft.proposedSku).normalized;
    const description = request.proposedDescription || masterDraft.confirmedDescription || '';

    liveItems.forEach(item => {
        const reasons: string[] = [];
        let score = 0;
        let matchType = 'Similar description';
        const liveSku = normalizeItemCode(item.sku).normalized;

        if (proposedSku && liveSku === proposedSku) {
            score = 1;
            matchType = 'Exact SKU match';
            reasons.push('SKU matches an active/live item.');
        }

        const descriptionScore = jaccardScore(description, `${item.name} ${item.description}`);
        if (descriptionScore > 0) {
            score = Math.max(score, Math.min(0.85, descriptionScore));
            reasons.push(`Description similarity ${(descriptionScore * 100).toFixed(0)}%.`);
        }

        if (request.itemGroup && item.category && request.itemGroup.toLowerCase() === item.category.toLowerCase()) {
            score += 0.08;
            reasons.push('Category/item group matches.');
        }

        if (masterDraft.productType && item.itemType && masterDraft.productType.toLowerCase() === item.itemType.toLowerCase()) {
            score += 0.07;
            reasons.push('Product type matches.');
        }

        const finalScore = Math.min(1, Number(score.toFixed(4)));
        if (finalScore >= 0.25) {
            candidates.push({
                source: 'LIVE_ITEM',
                sourceId: item.id,
                sku: item.sku,
                name: item.name,
                category: item.category,
                score: finalScore,
                matchType,
                reasons
            });
        }
    });

    previewRequests.forEach(existing => {
        if (existing.id === request.id) return;
        const existingSku = normalizeItemCode(String(existing.draftPayload?.proposedSku || '')).normalized;
        const reasons: string[] = [];
        let score = 0;

        if (proposedSku && existingSku === proposedSku) {
            score = 0.98;
            reasons.push('SKU matches another preview request.');
        }

        const descriptionScore = jaccardScore(description, existing.proposedDescription);
        if (descriptionScore > 0) {
            score = Math.max(score, Math.min(0.8, descriptionScore));
            reasons.push(`Preview description similarity ${(descriptionScore * 100).toFixed(0)}%.`);
        }

        if (score >= 0.25) {
            candidates.push({
                source: 'PREVIEW_REQUEST',
                sourceId: existing.id,
                sku: existingSku,
                name: existing.proposedDescription,
                score: Number(score.toFixed(4)),
                matchType: score >= 0.98 ? 'Preview SKU match' : 'Similar preview request',
                reasons
            });
        }
    });

    mappings.forEach(mapping => {
        if (!mapping.supplierSku || normalizeItemCode(mapping.supplierSku).normalized !== proposedSku) return;
        candidates.push({
            source: 'SUPPLIER_MAPPING',
            sourceId: mapping.id,
            sku: mapping.supplierSku,
            name: mapping.productName || mapping.internalSku || mapping.supplierSku,
            supplierName: mapping.supplierName,
            score: 0.9,
            matchType: 'Supplier mapping code match',
            reasons: ['Supplier SKU already exists in product mapping memory.']
        });
    });

    const seenSnapshotKeys = new Set<string>();
    stockSnapshots.forEach(snapshot => {
        const key = `${snapshot.supplierId}:${snapshot.supplierSku}`;
        if (seenSnapshotKeys.has(key)) return;
        seenSnapshotKeys.add(key);

        const snapshotSku = normalizeItemCode(snapshot.customerStockCode || snapshot.supplierSku).normalized;
        const descriptionScore = jaccardScore(description, snapshot.productName);
        if (snapshotSku === proposedSku || descriptionScore >= 0.35) {
            candidates.push({
                source: 'STOCK_SNAPSHOT',
                sourceId: snapshot.id,
                sku: snapshot.customerStockCode || snapshot.supplierSku,
                name: snapshot.productName,
                score: snapshotSku === proposedSku ? 0.8 : Number(descriptionScore.toFixed(4)),
                matchType: snapshotSku === proposedSku ? 'Stock code match' : 'Stock description similarity',
                reasons: snapshotSku === proposedSku
                    ? ['Supplier stock report already contains this code.']
                    : [`Stock report description similarity ${(descriptionScore * 100).toFixed(0)}%.`]
            });
        }
    });

    return candidates
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
};

export const calculatePreviewPricing = (
    purchase: Partial<PreviewPurchasePriceDraft>,
    sell: Partial<PreviewSellPriceDraft>
) => {
    const purchasePrice = Math.max(0, Number(purchase.purchasePriceExGst || 0));
    const freight = Math.max(0, Number(purchase.freightHandlingCost || 0));
    const landedCost = Number((purchasePrice + freight).toFixed(2));
    const sellPrice = Math.max(0, Number(sell.sellPriceExGst || 0));
    const marginAmount = Number((sellPrice - landedCost).toFixed(2));
    const marginPercent = sellPrice > 0 ? Number(((marginAmount / sellPrice) * 100).toFixed(2)) : 0;
    const approvalRequired = sellPrice > 0 && marginPercent < 25;

    return {
        landedCost,
        marginAmount,
        marginPercent,
        approvalRequired
    };
};

export const validatePreviewRequestForSubmit = (
    request: PreviewItemRequest,
    master: PreviewItemMasterDraft,
    purchase?: PreviewPurchasePriceDraft,
    sell?: PreviewSellPriceDraft
): PreviewValidationSummary => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request.proposedDescription?.trim()) errors.push('Proposed item description is required.');
    if (!request.requestType) errors.push('Request type is required.');
    if (!request.department) errors.push('Requesting department is required.');
    if (!request.businessUnit) errors.push('Business unit is required.');
    if (!request.requiredActivationDate) errors.push('Required activation date is required.');
    if (!request.purchaseEnabled && !request.saleEnabled) errors.push('At least one of purchase or sale must be enabled.');
    if (!master.proposedSku) errors.push('Generated SKU is required.');
    if (master.skuValidation && !master.skuValidation.isValid) errors.push(...master.skuValidation.errors);

    if (request.purchaseEnabled) {
        if (!purchase?.supplierId) errors.push('Supplier is required for purchase-enabled requests.');
        if (!purchase?.purchaseUom) errors.push('Purchase UOM is required.');
        if (!purchase?.purchasePriceExGst || purchase.purchasePriceExGst <= 0) errors.push('Purchase price must be greater than zero.');
        if (!purchase?.effectiveFrom) errors.push('Purchase price effective-from date is required.');
    }

    if (request.saleEnabled) {
        if (!sell?.saleUom) errors.push('Sale UOM is required.');
        if (!sell?.sellPriceExGst || sell.sellPriceExGst <= 0) errors.push('Sell price must be greater than zero.');
        if (!sell?.effectiveFrom) errors.push('Sell price effective-from date is required.');
    }

    if (request.salesforceVisible && request.saleEnabled && !sell?.publishToSalesforce) {
        warnings.push('Salesforce visible is enabled, but sell price is not marked to publish to Salesforce.');
    }

    if (request.requiredActivationDate) {
        const required = new Date(request.requiredActivationDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (required < today) errors.push('Required activation date cannot be before today.');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};

export const makePreviewRequestNumber = () => {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `PIR-${datePart}-${randomPart}`;
};

export const buildPreviewPublicationPayload = (
    request: PreviewItemRequest,
    master: PreviewItemMasterDraft,
    purchase?: PreviewPurchasePriceDraft,
    sell?: PreviewSellPriceDraft,
    targetSystem = 'Internal Catalogue'
) => ({
    previewOnly: true,
    requestId: request.id,
    requestNumber: request.requestNumber,
    item: {
        sku: master.proposedSku,
        name: request.proposedDescription,
        description: master.confirmedDescription || request.proposedDescription,
        category: master.itemCategory || request.itemGroup,
        productType: master.productType,
        rfidFlag: master.rfidFlag,
        cogFlag: master.cogFlag,
        itemWeight: master.itemWeight
    },
    purchasePrice: request.purchaseEnabled ? {
        supplierId: purchase?.supplierId,
        supplierName: purchase?.supplierName,
        supplierItemCode: purchase?.supplierItemCode,
        purchaseUom: purchase?.purchaseUom,
        purchasePriceExGst: purchase?.purchasePriceExGst,
        landedCost: purchase?.landedCost,
        effectiveFrom: purchase?.effectiveFrom,
        effectiveTo: purchase?.effectiveTo
    } : null,
    sellPrice: request.saleEnabled ? {
        priceType: sell?.priceType,
        saleUom: sell?.saleUom,
        sellPriceExGst: sell?.sellPriceExGst,
        taxCode: sell?.taxCode,
        marginPercent: sell?.marginPercent,
        marginAmount: sell?.marginAmount,
        effectiveFrom: sell?.effectiveFrom,
        effectiveTo: sell?.effectiveTo
    } : null,
    availability: {
        targetSystem,
        bundleEnabled: request.bundleEnabled,
        linenhubEnabled: request.linenhubEnabled,
        salesforceVisible: request.salesforceVisible,
        siteAvailability: 'All sites',
        businessUnit: request.businessUnit
    }
});
