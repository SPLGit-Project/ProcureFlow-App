import { supabase } from '../lib/supabaseClient';
import {
    ItemCreationPreviewConfig,
    PreviewDuplicateCheck,
    PreviewDuplicateOutcome,
    PreviewItemMasterDraft,
    PreviewItemRequest,
    PreviewItemRequestBundle,
    PreviewPublicationEvent,
    PreviewPurchasePriceDraft,
    PreviewSellPriceDraft
} from '../types';
import { buildPreviewPublicationPayload } from '../utils/itemCreationPreviewEngine';

const PREVIEW_CONFIG_DEFAULT: ItemCreationPreviewConfig = {
    previewEnabled: true,
    previewWriteBlock: true,
    goLiveEnabled: false
};

const previewOnlyMutationGuard = (config: ItemCreationPreviewConfig) => {
    if (!config.previewEnabled) {
        throw new Error('Item creation preview mode is disabled.');
    }
    if (config.goLiveEnabled) {
        throw new Error('Go-live mode is not implemented in this preview service.');
    }
};

const stableHash = (payload: unknown) => {
    const json = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
        hash = ((hash << 5) - hash + json.charCodeAt(i)) | 0;
    }
    return `preview-${Math.abs(hash).toString(16)}`;
};

const mapRequest = (row: any): PreviewItemRequest => ({
    id: row.id,
    requestNumber: row.request_number,
    requestType: row.request_type,
    lifecycleStatus: row.lifecycle_status,
    requestorUserId: row.requestor_user_id,
    requestorName: row.requestor_name,
    department: row.department,
    businessUnit: row.business_unit,
    branchSiteId: row.branch_site_id,
    branchSiteName: row.branch_site_name,
    requiredActivationDate: row.required_activation_date,
    businessReason: row.business_reason,
    businessReasonDetail: row.business_reason_detail,
    newOrReplacement: row.new_or_replacement,
    existingItemId: row.existing_item_id,
    customerReference: row.customer_reference,
    proposedDescription: row.proposed_description,
    itemGroup: row.item_group,
    division: row.division,
    purchaseEnabled: Boolean(row.purchase_enabled),
    saleEnabled: Boolean(row.sale_enabled),
    bundleEnabled: Boolean(row.bundle_enabled),
    linenhubEnabled: Boolean(row.linenhub_enabled),
    salesforceVisible: Boolean(row.salesforce_visible),
    duplicateCheckId: row.duplicate_check_id,
    currentMarginPercent: row.current_margin_percent === null ? undefined : Number(row.current_margin_percent),
    currentMarginAmount: row.current_margin_amount === null ? undefined : Number(row.current_margin_amount),
    validationSummary: row.validation_summary,
    draftPayload: row.draft_payload,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

const mapMaster = (row: any): PreviewItemMasterDraft | undefined => row ? ({
    id: row.id,
    requestId: row.request_id,
    proposedSku: row.proposed_sku,
    skuValidation: row.sku_validation,
    skuOverrideReason: row.sku_override_reason,
    confirmedDescription: row.confirmed_description,
    itemCategory: row.item_category,
    productType: row.product_type,
    sizeCode: row.size_code,
    varietyCode: row.variety_code,
    colourCode: row.colour_code,
    gsmCode: row.gsm_code,
    rfidFlag: Boolean(row.rfid_flag),
    cogFlag: Boolean(row.cog_flag),
    cogCustomer: row.cog_customer,
    itemWeight: row.item_weight === null ? undefined : Number(row.item_weight),
    purchaseUom: row.purchase_uom,
    saleUom: row.sale_uom,
    metadata: row.metadata,
    lockedAt: row.locked_at
}) : undefined;

const mapPurchase = (row: any): PreviewPurchasePriceDraft | undefined => row ? ({
    id: row.id,
    requestId: row.request_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    supplierItemCode: row.supplier_item_code,
    purchaseUom: row.purchase_uom,
    purchasePriceExGst: row.purchase_price_ex_gst === null ? undefined : Number(row.purchase_price_ex_gst),
    purchaseCurrency: row.purchase_currency,
    minimumOrderQuantity: row.minimum_order_quantity === null ? undefined : Number(row.minimum_order_quantity),
    leadTimeDays: row.lead_time_days === null ? undefined : Number(row.lead_time_days),
    freightHandlingCost: row.freight_handling_cost === null ? undefined : Number(row.freight_handling_cost),
    landedCost: row.landed_cost === null ? undefined : Number(row.landed_cost),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    validationSummary: row.validation_summary,
    lockedAt: row.locked_at
}) : undefined;

const mapSell = (row: any): PreviewSellPriceDraft | undefined => row ? ({
    id: row.id,
    requestId: row.request_id,
    priceType: row.price_type,
    customerReference: row.customer_reference,
    customerGroupReference: row.customer_group_reference,
    saleUom: row.sale_uom,
    sellPriceExGst: row.sell_price_ex_gst === null ? undefined : Number(row.sell_price_ex_gst),
    taxCode: row.tax_code,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    marginPercent: row.margin_percent === null ? undefined : Number(row.margin_percent),
    marginAmount: row.margin_amount === null ? undefined : Number(row.margin_amount),
    approvalRequired: Boolean(row.approval_required),
    publishToSalesforce: Boolean(row.publish_to_salesforce),
    publishToBundle: Boolean(row.publish_to_bundle),
    publishToLinenHub: Boolean(row.publish_to_linenhub),
    validationSummary: row.validation_summary,
    lockedAt: row.locked_at
}) : undefined;

const mapDuplicate = (row: any): PreviewDuplicateCheck => ({
    id: row.id,
    requestId: row.request_id,
    searchTimestamp: row.search_timestamp,
    searchTerms: row.search_terms,
    candidates: row.candidates || [],
    matchCount: Number(row.match_count || 0),
    highestMatchScore: Number(row.highest_match_score || 0),
    selectedOutcome: row.selected_outcome,
    justification: row.justification,
    performedBy: row.performed_by
});

const mapPublication = (row: any): PreviewPublicationEvent => ({
    id: row.id,
    requestId: row.request_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    correlationId: row.correlation_id,
    sourceSystem: row.source_system,
    targetSystem: row.target_system,
    payloadHash: row.payload_hash,
    payload: row.payload,
    status: row.status,
    retryCount: Number(row.retry_count || 0),
    lastError: row.last_error,
    externalItemId: row.external_item_id,
    externalPriceId: row.external_price_id,
    publishedAt: row.published_at,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

export const itemCreationPreviewService = {
    getConfig: async (): Promise<ItemCreationPreviewConfig> => {
        const { data, error } = await supabase
            .from('app_config')
            .select('key,value')
            .in('key', [
                'item_creation_preview_enabled',
                'item_creation_preview_write_block',
                'item_creation_go_live_enabled'
            ]);

        if (error) {
            console.warn('Preview config unavailable, using safe defaults:', error);
            return PREVIEW_CONFIG_DEFAULT;
        }

        const values = new Map((data || []).map((row: any) => [row.key, row.value]));
        return {
            previewEnabled: values.get('item_creation_preview_enabled') ?? PREVIEW_CONFIG_DEFAULT.previewEnabled,
            previewWriteBlock: values.get('item_creation_preview_write_block') ?? PREVIEW_CONFIG_DEFAULT.previewWriteBlock,
            goLiveEnabled: values.get('item_creation_go_live_enabled') ?? PREVIEW_CONFIG_DEFAULT.goLiveEnabled
        };
    },

    listBundles: async (): Promise<PreviewItemRequestBundle[]> => {
        const { data, error } = await supabase
            .from('preview_item_requests')
            .select(`
                *,
                master:preview_item_master_drafts(*),
                purchase:preview_purchase_price_drafts(*),
                sell:preview_sell_price_drafts(*),
                duplicate_checks:preview_item_duplicate_checks(*),
                publication_events:preview_publication_events(*)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((row: any) => ({
            request: mapRequest(row),
            masterDraft: mapMaster(Array.isArray(row.master) ? row.master[0] : row.master),
            purchaseDraft: mapPurchase(Array.isArray(row.purchase) ? row.purchase[0] : row.purchase),
            sellDraft: mapSell(Array.isArray(row.sell) ? row.sell[0] : row.sell),
            duplicateChecks: (row.duplicate_checks || []).map(mapDuplicate).sort((a: PreviewDuplicateCheck, b: PreviewDuplicateCheck) => new Date(b.searchTimestamp).getTime() - new Date(a.searchTimestamp).getTime()),
            publicationEvents: (row.publication_events || []).map(mapPublication).sort((a: PreviewPublicationEvent, b: PreviewPublicationEvent) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
        }));
    },

    saveBundle: async (
        bundle: {
            request: PreviewItemRequest;
            masterDraft: PreviewItemMasterDraft;
            purchaseDraft?: PreviewPurchasePriceDraft;
            sellDraft?: PreviewSellPriceDraft;
        },
        performedBy?: string
    ): Promise<void> => {
        const config = await itemCreationPreviewService.getConfig();
        previewOnlyMutationGuard(config);

        const requestPayload = {
            id: bundle.request.id,
            request_number: bundle.request.requestNumber,
            request_type: bundle.request.requestType,
            lifecycle_status: bundle.request.lifecycleStatus,
            requestor_user_id: bundle.request.requestorUserId,
            requestor_name: bundle.request.requestorName,
            department: bundle.request.department,
            business_unit: bundle.request.businessUnit,
            branch_site_id: bundle.request.branchSiteId || null,
            branch_site_name: bundle.request.branchSiteName || null,
            required_activation_date: bundle.request.requiredActivationDate || null,
            business_reason: bundle.request.businessReason,
            business_reason_detail: bundle.request.businessReasonDetail,
            new_or_replacement: bundle.request.newOrReplacement,
            existing_item_id: bundle.request.existingItemId || null,
            customer_reference: bundle.request.customerReference,
            proposed_description: bundle.request.proposedDescription,
            item_group: bundle.request.itemGroup,
            division: bundle.request.division,
            purchase_enabled: bundle.request.purchaseEnabled,
            sale_enabled: bundle.request.saleEnabled,
            bundle_enabled: bundle.request.bundleEnabled,
            linenhub_enabled: bundle.request.linenhubEnabled,
            salesforce_visible: bundle.request.salesforceVisible,
            current_margin_percent: bundle.request.currentMarginPercent,
            current_margin_amount: bundle.request.currentMarginAmount,
            validation_summary: bundle.request.validationSummary || {},
            draft_payload: bundle.request.draftPayload || {},
            created_by: bundle.request.createdBy || performedBy,
            updated_at: new Date().toISOString()
        };

        const { error: requestError } = await supabase
            .from('preview_item_requests')
            .upsert(requestPayload, { onConflict: 'id' });
        if (requestError) throw requestError;

        const { error: masterError } = await supabase
            .from('preview_item_master_drafts')
            .upsert({
                id: bundle.masterDraft.id,
                request_id: bundle.request.id,
                proposed_sku: bundle.masterDraft.proposedSku,
                sku_validation: bundle.masterDraft.skuValidation || {},
                sku_override_reason: bundle.masterDraft.skuOverrideReason,
                confirmed_description: bundle.masterDraft.confirmedDescription,
                item_category: bundle.masterDraft.itemCategory,
                product_type: bundle.masterDraft.productType,
                size_code: bundle.masterDraft.sizeCode,
                variety_code: bundle.masterDraft.varietyCode,
                colour_code: bundle.masterDraft.colourCode,
                gsm_code: bundle.masterDraft.gsmCode,
                rfid_flag: bundle.masterDraft.rfidFlag,
                cog_flag: bundle.masterDraft.cogFlag,
                cog_customer: bundle.masterDraft.cogCustomer,
                item_weight: bundle.masterDraft.itemWeight,
                purchase_uom: bundle.masterDraft.purchaseUom,
                sale_uom: bundle.masterDraft.saleUom,
                metadata: bundle.masterDraft.metadata || {},
                updated_at: new Date().toISOString()
            }, { onConflict: 'request_id' });
        if (masterError) throw masterError;

        if (bundle.purchaseDraft) {
            const { error } = await supabase
                .from('preview_purchase_price_drafts')
                .upsert({
                    id: bundle.purchaseDraft.id,
                    request_id: bundle.request.id,
                    supplier_id: bundle.purchaseDraft.supplierId || null,
                    supplier_name: bundle.purchaseDraft.supplierName,
                    supplier_item_code: bundle.purchaseDraft.supplierItemCode,
                    purchase_uom: bundle.purchaseDraft.purchaseUom,
                    purchase_price_ex_gst: bundle.purchaseDraft.purchasePriceExGst,
                    purchase_currency: bundle.purchaseDraft.purchaseCurrency || 'AUD',
                    minimum_order_quantity: bundle.purchaseDraft.minimumOrderQuantity,
                    lead_time_days: bundle.purchaseDraft.leadTimeDays,
                    freight_handling_cost: bundle.purchaseDraft.freightHandlingCost || 0,
                    landed_cost: bundle.purchaseDraft.landedCost,
                    effective_from: bundle.purchaseDraft.effectiveFrom || null,
                    effective_to: bundle.purchaseDraft.effectiveTo || null,
                    validation_summary: bundle.purchaseDraft.validationSummary || {},
                    updated_at: new Date().toISOString()
                }, { onConflict: 'request_id' });
            if (error) throw error;
        }

        if (bundle.sellDraft) {
            const { error } = await supabase
                .from('preview_sell_price_drafts')
                .upsert({
                    id: bundle.sellDraft.id,
                    request_id: bundle.request.id,
                    price_type: bundle.sellDraft.priceType,
                    customer_reference: bundle.sellDraft.customerReference,
                    customer_group_reference: bundle.sellDraft.customerGroupReference,
                    sale_uom: bundle.sellDraft.saleUom,
                    sell_price_ex_gst: bundle.sellDraft.sellPriceExGst,
                    tax_code: bundle.sellDraft.taxCode,
                    effective_from: bundle.sellDraft.effectiveFrom || null,
                    effective_to: bundle.sellDraft.effectiveTo || null,
                    margin_percent: bundle.sellDraft.marginPercent,
                    margin_amount: bundle.sellDraft.marginAmount,
                    approval_required: bundle.sellDraft.approvalRequired || false,
                    publish_to_salesforce: bundle.sellDraft.publishToSalesforce,
                    publish_to_bundle: bundle.sellDraft.publishToBundle,
                    publish_to_linenhub: bundle.sellDraft.publishToLinenHub,
                    validation_summary: bundle.sellDraft.validationSummary || {},
                    updated_at: new Date().toISOString()
                }, { onConflict: 'request_id' });
            if (error) throw error;
        }

        await itemCreationPreviewService.logAudit(bundle.request.id, 'PREVIEW_ITEM_REQUEST_SAVED', performedBy, {
            requestNumber: bundle.request.requestNumber,
            status: bundle.request.lifecycleStatus
        });
    },

    saveDuplicateCheck: async (
        requestId: string,
        check: Omit<PreviewDuplicateCheck, 'id' | 'searchTimestamp'>,
        performedBy?: string
    ): Promise<PreviewDuplicateCheck> => {
        const config = await itemCreationPreviewService.getConfig();
        previewOnlyMutationGuard(config);

        const { data, error } = await supabase
            .from('preview_item_duplicate_checks')
            .insert({
                request_id: requestId,
                search_terms: check.searchTerms,
                candidates: check.candidates,
                match_count: check.matchCount,
                highest_match_score: check.highestMatchScore,
                selected_outcome: check.selectedOutcome,
                justification: check.justification,
                performed_by: performedBy
            })
            .select('*')
            .single();
        if (error) throw error;

        await supabase
            .from('preview_item_requests')
            .update({
                duplicate_check_id: data.id,
                lifecycle_status: check.highestMatchScore >= 0.85 ? 'Duplicate Review Required' : 'Data Review',
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        await itemCreationPreviewService.logAudit(requestId, 'PREVIEW_DUPLICATE_CHECK_COMPLETED', performedBy, {
            matchCount: check.matchCount,
            highestMatchScore: check.highestMatchScore,
            selectedOutcome: check.selectedOutcome
        });

        return mapDuplicate(data);
    },

    updateRequestStatus: async (
        requestId: string,
        status: PreviewItemRequest['lifecycleStatus'],
        performedBy?: string,
        comment?: string
    ): Promise<void> => {
        const config = await itemCreationPreviewService.getConfig();
        previewOnlyMutationGuard(config);

        const { error } = await supabase
            .from('preview_item_requests')
            .update({
                lifecycle_status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);
        if (error) throw error;

        await itemCreationPreviewService.logAudit(requestId, 'PREVIEW_REQUEST_STATUS_UPDATED', performedBy, {
            status,
            comment
        });
    },

    recordApprovalDecision: async (
        requestId: string,
        decision: 'Approve' | 'Reject' | 'Escalate',
        approverUserId?: string,
        approverName?: string,
        comments?: string,
        matchedRule = 'Preview configured rule'
    ): Promise<void> => {
        const config = await itemCreationPreviewService.getConfig();
        previewOnlyMutationGuard(config);

        const { data: instance, error: instanceError } = await supabase
            .from('preview_item_approval_instances')
            .insert({
                request_id: requestId,
                status: decision === 'Approve' ? 'Approved' : decision === 'Reject' ? 'Rejected' : 'Escalated',
                matched_rule: matchedRule,
                completed_at: decision === 'Escalate' ? null : new Date().toISOString()
            })
            .select('*')
            .single();
        if (instanceError) throw instanceError;

        const { error: decisionError } = await supabase
            .from('preview_item_approval_decisions')
            .insert({
                approval_instance_id: instance.id,
                request_id: requestId,
                approver_user_id: approverUserId || null,
                approver_name: approverName,
                decision,
                comments,
                matched_rule: matchedRule
            });
        if (decisionError) throw decisionError;

        const nextStatus = decision === 'Approve'
            ? 'Approved'
            : decision === 'Reject'
                ? 'Revision Required'
                : 'Approval Pending';
        if (decision === 'Approve') {
            const lockedAt = new Date().toISOString();
            await Promise.all([
                supabase.from('preview_item_master_drafts').update({ locked_at: lockedAt }).eq('request_id', requestId),
                supabase.from('preview_purchase_price_drafts').update({ locked_at: lockedAt }).eq('request_id', requestId),
                supabase.from('preview_sell_price_drafts').update({ locked_at: lockedAt }).eq('request_id', requestId)
            ]);
        }
        await itemCreationPreviewService.updateRequestStatus(requestId, nextStatus, approverUserId, comments);
    },

    simulatePublication: async (
        bundle: PreviewItemRequestBundle,
        targetSystem: PreviewPublicationEvent['targetSystem'],
        outcome: 'success' | 'failure' | 'retry',
        performedBy?: string
    ): Promise<void> => {
        const config = await itemCreationPreviewService.getConfig();
        previewOnlyMutationGuard(config);
        if (!bundle.masterDraft) throw new Error('Cannot simulate publication without a master draft.');

        const payload = buildPreviewPublicationPayload(
            bundle.request,
            bundle.masterDraft,
            bundle.purchaseDraft,
            bundle.sellDraft,
            targetSystem
        );
        const now = new Date().toISOString();
        const status = outcome === 'success' ? 'Acknowledged' : outcome === 'retry' ? 'Retrying' : 'Failed';
        const payloadHash = stableHash(payload);

        const { error } = await supabase
            .from('preview_publication_events')
            .upsert({
                request_id: bundle.request.id,
                event_type: 'PreviewCataloguePublication',
                event_version: '1.0',
                correlation_id: bundle.request.id,
                source_system: 'ProcureFlow Preview',
                target_system: targetSystem,
                payload_hash: payloadHash,
                payload,
                status,
                retry_count: outcome === 'retry' ? 1 : 0,
                last_error: outcome === 'failure' ? 'Simulated downstream failure.' : null,
                external_item_id: outcome === 'success' ? `PREVIEW-${bundle.masterDraft.proposedSku}` : null,
                external_price_id: outcome === 'success' && bundle.sellDraft ? `PRICE-${bundle.request.requestNumber}` : null,
                published_at: now,
                acknowledged_at: outcome === 'success' ? now : null,
                updated_at: now
            }, { onConflict: 'request_id,target_system,payload_hash' });
        if (error) throw error;

        const nextStatus = outcome === 'success' ? 'Partially Published' : 'Publishing';
        await itemCreationPreviewService.updateRequestStatus(bundle.request.id, nextStatus, performedBy, `${targetSystem} simulated ${outcome}`);
    },

    logAudit: async (
        requestId: string | undefined,
        actionType: string,
        performedBy?: string,
        summary: Record<string, unknown> = {},
        details: Record<string, unknown> = {}
    ): Promise<void> => {
        const { error } = await supabase
            .from('preview_item_audit_logs')
            .insert({
                request_id: requestId || null,
                action_type: actionType,
                performed_by: performedBy || null,
                summary,
                details,
                mode: 'PREVIEW'
            });
        if (error) console.warn('Preview audit write failed:', error);
    }
};
