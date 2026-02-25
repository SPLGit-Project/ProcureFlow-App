import { Item, ItemPriceOption } from '../types';

const toSafeNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(0, parsed);
};

const toSafeLabel = (value: unknown, fallback: string): string => {
    const text = String(value || '').trim();
    return text || fallback;
};

const toSafeId = (value: unknown, fallback: string): string => {
    const text = String(value || '').trim();
    return text || fallback;
};

export const normalizeItemPriceOptions = (item?: Partial<Item> | null): ItemPriceOption[] => {
    const specs = (item?.specs && typeof item.specs === 'object') ? item.specs : {};
    const rawOptions = Array.isArray(item?.priceOptions)
        ? item?.priceOptions
        : Array.isArray((specs as Record<string, unknown>)?.priceOptions)
            ? ((specs as Record<string, unknown>).priceOptions as ItemPriceOption[])
            : [];

    const mapped = rawOptions
        .map((opt, index) => ({
            id: toSafeId(opt?.id, `opt-${index + 1}`),
            label: toSafeLabel(opt?.label, `Option ${index + 1}`),
            price: toSafeNumber(opt?.price, 0),
            isDefault: Boolean(opt?.isDefault),
            activeFlag: opt?.activeFlag !== false
        }))
        .filter(opt => opt.activeFlag !== false);

    if (mapped.length === 0) {
        return [{
            id: 'standard',
            label: 'Standard',
            price: toSafeNumber(item?.unitPrice, 0),
            isDefault: true,
            activeFlag: true
        }];
    }

    const hasDefault = mapped.some(opt => opt.isDefault);
    return mapped.map((opt, index) => ({
        ...opt,
        isDefault: hasDefault ? opt.isDefault : index === 0
    }));
};

export const getDefaultItemPriceOption = (item?: Partial<Item> | null): ItemPriceOption => {
    const options = normalizeItemPriceOptions(item);
    return options.find(opt => opt.isDefault) || options[0];
};

export const buildItemSpecsWithPriceOptions = (item: Partial<Item>): Item['specs'] => {
    const nextSpecs = {
        ...(item.specs && typeof item.specs === 'object' ? item.specs : {})
    } as Record<string, unknown>;

    nextSpecs.priceOptions = normalizeItemPriceOptions(item);
    return nextSpecs as Item['specs'];
};

