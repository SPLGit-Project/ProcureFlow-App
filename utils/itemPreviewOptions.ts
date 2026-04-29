import { AttributeOption, AttributeType, PreviewItemRequestType } from '../types';

export interface ItemPreviewOptionGroup {
    type: AttributeType;
    label: string;
    description: string;
    defaults: string[];
}

export const ITEM_PREVIEW_OPTION_GROUPS: ItemPreviewOptionGroup[] = [
    {
        type: 'PREVIEW_REQUEST_TYPE',
        label: 'Request type',
        description: 'Workflow scenario selected at the start of an item preview request.',
        defaults: [
            'New Purchase Item',
            'New Sale Item',
            'Purchase + Sale Item',
            'Replacement Item',
            'Customer Own Goods Item',
            'Bundle-Only Item',
            'LinenHub-Only Item',
            'Shared Operational Item'
        ]
    },
    {
        type: 'PREVIEW_DEPARTMENT',
        label: 'Department',
        description: 'Requesting or owning team used for routing and reporting.',
        defaults: ['Sales', 'Procurement', 'Operations', 'Customer Care', 'Finance', 'Master Data']
    },
    {
        type: 'PREVIEW_BUSINESS_UNIT',
        label: 'Business unit',
        description: 'Commercial or operational classification used for filtering and SKU context.',
        defaults: ['Traditional', 'Daily Hire', 'LinenHub', 'Accommodation', 'Healthcare']
    },
    {
        type: 'PREVIEW_BUSINESS_REASON',
        label: 'Business reason',
        description: 'Reason codes captured on item preview requests.',
        defaults: ['New Contract', 'New Customer', 'Supplier Change', 'Operational Requirement', 'Replacement', 'QA Issue', 'Specification Change', 'End of Life', 'Other']
    },
    {
        type: 'PREVIEW_PRICE_TYPE',
        label: 'Sell price type',
        description: 'Commercial pricing scope applied to preview sell prices.',
        defaults: ['Standard', 'Group', 'Customer-Specific', 'Contract', 'Promotional']
    },
    {
        type: 'PREVIEW_TAX_CODE',
        label: 'Tax code',
        description: 'Tax treatment available on preview sell prices.',
        defaults: ['GST', 'GST Free', 'Input Taxed', 'Out of Scope']
    },
    {
        type: 'UOM',
        label: 'Unit of measure',
        description: 'Shared item UOM list used by current item management and Item Preview.',
        defaults: ['Each', 'Pack', 'Dozen', 'Kg', 'Carton']
    }
];

export const getPreviewOptionValues = (
    options: AttributeOption[],
    type: AttributeType,
    defaults: string[]
): string[] => {
    const persisted = options
        .filter(option => option.type === type && option.activeFlag !== false)
        .map(option => option.value)
        .filter(Boolean);

    const source = persisted.length > 0 ? persisted : defaults;
    return Array.from(new Set(source)).sort((a, b) => a.localeCompare(b));
};

export const getPreviewRequestTypes = (options: AttributeOption[]): PreviewItemRequestType[] =>
    getPreviewOptionValues(
        options,
        'PREVIEW_REQUEST_TYPE',
        ITEM_PREVIEW_OPTION_GROUPS.find(group => group.type === 'PREVIEW_REQUEST_TYPE')?.defaults || []
    ) as PreviewItemRequestType[];
