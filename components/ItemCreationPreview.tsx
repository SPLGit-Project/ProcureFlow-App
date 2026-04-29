import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  FlaskConical,
  Info,
  Package,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ItemCreationPreviewConfig,
  PreviewDuplicateOutcome,
  PreviewItemMasterDraft,
  PreviewItemRequest,
  PreviewItemRequestBundle,
  PreviewItemRequestStatus,
  PreviewItemRequestType,
  PreviewPurchasePriceDraft,
  PreviewSellPriceDraft
} from '../types';
import { ToastContainer, useToast } from './ToastNotification';
import ItemApprovalReview from './ItemApprovalReview';
import {
  calculatePreviewPricing,
  findPreviewDuplicateCandidates,
  generateMdSku,
  makePreviewRequestNumber,
  validatePreviewRequestForSubmit,
  validatePreviewSku
} from '../utils/itemCreationPreviewEngine';
import { getPreviewOptionValues, getPreviewRequestTypes, ITEM_PREVIEW_OPTION_GROUPS } from '../utils/itemPreviewOptions';
import { itemCreationPreviewService } from '../services/itemCreationPreviewService';

type PreviewTab = 'WORKBENCH' | 'REQUESTS' | 'CATALOGUE' | 'SHADOW';

interface PreviewFormState {
  id: string;
  requestNumber: string;
  requestType: PreviewItemRequestType;
  lifecycleStatus: PreviewItemRequestStatus;
  department: string;
  businessUnit: string;
  newOrReplacement: 'New Item' | 'Replacement';
  existingItemId: string;
  requiredActivationDate: string;
  businessReason: string;
  businessReasonDetail: string;
  customerReference: string;
  proposedDescription: string;
  itemGroup: string;
  productType: string;
  sizeCode: string;
  varietyCode: string;
  colourCode: string;
  gsmCode: string;
  division: string;
  purchaseEnabled: boolean;
  saleEnabled: boolean;
  bundleEnabled: boolean;
  linenhubEnabled: boolean;
  salesforceVisible: boolean;
  rfidFlag: boolean;
  cogFlag: boolean;
  cogCustomer: string;
  itemWeight: string;
  supplierId: string;
  supplierItemCode: string;
  purchaseUom: string;
  purchasePriceExGst: string;
  purchaseCurrency: string;
  minimumOrderQuantity: string;
  leadTimeDays: string;
  freightHandlingCost: string;
  purchaseEffectiveFrom: string;
  purchaseEffectiveTo: string;
  priceType: string;
  saleUom: string;
  sellPriceExGst: string;
  taxCode: string;
  sellEffectiveFrom: string;
  sellEffectiveTo: string;
  publishToSalesforce: boolean;
  publishToBundle: boolean;
  publishToLinenHub: boolean;
  customerGroupReference: string;
  branchSiteId: string;
  sapMapping: string;
  duplicateOutcome: PreviewDuplicateOutcome;
  duplicateJustification: string;
}

const previewDefaults = (type: string) => ITEM_PREVIEW_OPTION_GROUPS.find(group => group.type === type)?.defaults || [];

const todayInput = () => new Date().toISOString().slice(0, 10);

const createEmptyForm = (): PreviewFormState => ({
  id: crypto.randomUUID(),
  requestNumber: makePreviewRequestNumber(),
  requestType: 'Purchase + Sale Item',
  lifecycleStatus: 'Draft',
  department: 'Master Data',
  businessUnit: 'Traditional',
  newOrReplacement: 'New Item',
  existingItemId: '',
  requiredActivationDate: todayInput(),
  businessReason: 'Operational Requirement',
  businessReasonDetail: '',
  customerReference: '',
  proposedDescription: '',
  itemGroup: '',
  productType: '',
  sizeCode: '',
  varietyCode: '01',
  colourCode: '',
  gsmCode: '',
  division: '',
  purchaseEnabled: true,
  saleEnabled: true,
  bundleEnabled: true,
  linenhubEnabled: false,
  salesforceVisible: true,
  rfidFlag: false,
  cogFlag: false,
  cogCustomer: '',
  itemWeight: '',
  supplierId: '',
  supplierItemCode: '',
  purchaseUom: 'Each',
  purchasePriceExGst: '',
  purchaseCurrency: 'AUD',
  minimumOrderQuantity: '',
  leadTimeDays: '',
  freightHandlingCost: '0',
  purchaseEffectiveFrom: todayInput(),
  purchaseEffectiveTo: '',
  priceType: 'Standard',
  saleUom: 'Each',
  sellPriceExGst: '',
  taxCode: 'GST',
  sellEffectiveFrom: todayInput(),
  sellEffectiveTo: '',
  publishToSalesforce: true,
  publishToBundle: true,
  publishToLinenHub: false,
  customerGroupReference: '',
  branchSiteId: '',
  sapMapping: '',
  duplicateOutcome: 'NoDuplicate',
  duplicateJustification: ''
});

const statusClass = (status: string) => {
  if (['Approved', 'Fully Published', 'Active'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20';
  if (['Revision Required', 'Rejected / On Hold'].includes(status)) return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20';
  if (['Publishing', 'Partially Published', 'Approval Pending', 'Duplicate Review Required'].includes(status)) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20';
  return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20';
};

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const ItemCreationPreview = () => {
  const {
    currentUser,
    hasPermission,
    items,
    suppliers,
    attributeOptions,
    mappings,
    stockSnapshots
  } = useApp();
  const { toasts, dismissToast, success, error, warning, info } = useToast();
  const [activeTab, setActiveTab] = useState<PreviewTab>('WORKBENCH');
  const [config, setConfig] = useState<ItemCreationPreviewConfig | null>(null);
  const [bundles, setBundles] = useState<PreviewItemRequestBundle[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string>('');
  const [form, setForm] = useState<PreviewFormState>(() => createEmptyForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [catalogueMode, setCatalogueMode] = useState<'COMBINED' | 'LIVE' | 'PREVIEW'>('COMBINED');
  const [reviewBundleId, setReviewBundleId] = useState<string>('');

  const canUsePreview = hasPermission('manage_development') || currentUser?.role === 'ADMIN';

  const loadPreview = async () => {
    setIsLoading(true);
    try {
      const [nextConfig, nextBundles] = await Promise.all([
        itemCreationPreviewService.getConfig(),
        itemCreationPreviewService.listBundles()
      ]);
      setConfig(nextConfig);
      setBundles(nextBundles);
    } catch (err) {
      console.error(err);
      error(`Failed to load item creation preview: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canUsePreview) {
      loadPreview();
    } else {
      setIsLoading(false);
    }
  }, [canUsePreview]);

  const selectedBundle = bundles.find(bundle => bundle.request.id === selectedBundleId);

  const requestTypeOptions = useMemo(() => getPreviewRequestTypes(attributeOptions), [attributeOptions]);
  const departmentOptions = useMemo(() => getPreviewOptionValues(attributeOptions, 'PREVIEW_DEPARTMENT', previewDefaults('PREVIEW_DEPARTMENT')), [attributeOptions]);
  const businessUnitOptions = useMemo(() => getPreviewOptionValues(attributeOptions, 'PREVIEW_BUSINESS_UNIT', previewDefaults('PREVIEW_BUSINESS_UNIT')), [attributeOptions]);
  const businessReasonOptions = useMemo(() => getPreviewOptionValues(attributeOptions, 'PREVIEW_BUSINESS_REASON', previewDefaults('PREVIEW_BUSINESS_REASON')), [attributeOptions]);
  const uomOptions = useMemo(() => getPreviewOptionValues(attributeOptions, 'UOM', previewDefaults('UOM')), [attributeOptions]);
  const priceTypeOptions = useMemo(() => getPreviewOptionValues(attributeOptions, 'PREVIEW_PRICE_TYPE', previewDefaults('PREVIEW_PRICE_TYPE')), [attributeOptions]);
  const taxCodeOptions = useMemo(() => getPreviewOptionValues(attributeOptions, 'PREVIEW_TAX_CODE', previewDefaults('PREVIEW_TAX_CODE')), [attributeOptions]);
  const customerPricingGroupOptions = useMemo(() => getPreviewOptionValues(attributeOptions, 'PREVIEW_CUSTOMER_PRICING_GROUP', previewDefaults('PREVIEW_CUSTOMER_PRICING_GROUP')), [attributeOptions]);
  const sapMappingOptions = useMemo(() => getPreviewOptionValues(attributeOptions, 'PREVIEW_SAP_MAPPING', previewDefaults('PREVIEW_SAP_MAPPING')), [attributeOptions]);

  // Conditional field visibility based on request type
  const isReplacement = form.requestType === 'Replacement Item';
  const isCog = form.requestType === 'Customer Own Goods Item' || form.cogFlag;
  const needsCustomerRef = ['Customer Own Goods Item', 'Bundle-Only Item', 'LinenHub-Only Item'].includes(form.requestType) || isCog;
  const isGroupPrice = form.priceType === 'Group';
  const isCustomerSpecificPrice = ['Customer-Specific', 'Contract'].includes(form.priceType);

  const categoryOptions = useMemo(() => {
    const values = new Set<string>();
    attributeOptions.filter(option => ['CATEGORY', 'CATALOG', 'POOL'].includes(option.type)).forEach(option => values.add(option.value));
    items.forEach(item => {
      if (item.category) values.add(item.category);
      if (item.itemCatalog) values.add(item.itemCatalog);
    });
    return Array.from(values).sort();
  }, [attributeOptions, items]);

  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    attributeOptions.filter(option => option.type === 'TYPE').forEach(option => values.add(option.value));
    items.forEach(item => {
      if (item.itemType) values.add(item.itemType);
    });
    return Array.from(values).sort();
  }, [attributeOptions, items]);

  const proposedSku = useMemo(() => generateMdSku({
    purchaseEnabled: form.purchaseEnabled,
    saleEnabled: form.saleEnabled,
    rfidFlag: form.rfidFlag,
    category: form.itemGroup || form.businessUnit,
    productType: form.productType,
    size: form.sizeCode,
    variety: form.varietyCode,
    colour: form.colourCode,
    gsm: form.gsmCode,
    cogFlag: form.cogFlag,
    businessUnit: form.businessUnit
  }), [form]);

  const skuValidation = useMemo(() => validatePreviewSku(
    proposedSku,
    items,
    bundles.map(bundle => ({
      ...bundle.request,
      draftPayload: {
        ...(bundle.request.draftPayload || {}),
        proposedSku: bundle.masterDraft?.proposedSku || bundle.request.draftPayload?.proposedSku
      }
    })),
    form.id
  ), [proposedSku, items, bundles, form.id]);

  const pricing = useMemo(() => calculatePreviewPricing(
    {
      purchasePriceExGst: toNumber(form.purchasePriceExGst),
      freightHandlingCost: toNumber(form.freightHandlingCost)
    },
    {
      sellPriceExGst: toNumber(form.sellPriceExGst)
    }
  ), [form.purchasePriceExGst, form.freightHandlingCost, form.sellPriceExGst]);

  const showApprovalWarning = form.saleEnabled && pricing.marginPercent < 25 && (pricing.marginPercent !== 0 || form.sellPriceExGst !== '');

  const latestDuplicateCheck = selectedBundle?.duplicateChecks[0];

  const populateFromBundle = (bundle: PreviewItemRequestBundle) => {
    const request = bundle.request;
    const master = bundle.masterDraft;
    const purchase = bundle.purchaseDraft;
    const sell = bundle.sellDraft;
    setSelectedBundleId(request.id);
    setForm({
      ...createEmptyForm(),
      id: request.id,
      requestNumber: request.requestNumber,
      requestType: request.requestType as PreviewItemRequestType,
      lifecycleStatus: request.lifecycleStatus,
      department: request.department || 'Master Data',
      businessUnit: request.businessUnit || 'Traditional',
      newOrReplacement: request.newOrReplacement,
      existingItemId: request.existingItemId || '',
      requiredActivationDate: request.requiredActivationDate || todayInput(),
      businessReason: request.businessReason || 'Operational Requirement',
      businessReasonDetail: request.businessReasonDetail || '',
      customerReference: request.customerReference || '',
      proposedDescription: request.proposedDescription || '',
      itemGroup: request.itemGroup || master?.itemCategory || '',
      productType: master?.productType || '',
      sizeCode: master?.sizeCode || '',
      varietyCode: master?.varietyCode || '01',
      colourCode: master?.colourCode || '',
      gsmCode: master?.gsmCode || '',
      division: request.division || '',
      purchaseEnabled: request.purchaseEnabled,
      saleEnabled: request.saleEnabled,
      bundleEnabled: request.bundleEnabled,
      linenhubEnabled: request.linenhubEnabled,
      salesforceVisible: request.salesforceVisible,
      rfidFlag: master?.rfidFlag || false,
      cogFlag: master?.cogFlag || false,
      cogCustomer: master?.cogCustomer || '',
      itemWeight: master?.itemWeight ? String(master.itemWeight) : '',
      supplierId: purchase?.supplierId || '',
      supplierItemCode: purchase?.supplierItemCode || '',
      purchaseUom: purchase?.purchaseUom || 'Each',
      purchasePriceExGst: purchase?.purchasePriceExGst ? String(purchase.purchasePriceExGst) : '',
      purchaseCurrency: purchase?.purchaseCurrency || 'AUD',
      minimumOrderQuantity: purchase?.minimumOrderQuantity ? String(purchase.minimumOrderQuantity) : '',
      leadTimeDays: purchase?.leadTimeDays ? String(purchase.leadTimeDays) : '',
      freightHandlingCost: purchase?.freightHandlingCost ? String(purchase.freightHandlingCost) : '0',
      purchaseEffectiveFrom: purchase?.effectiveFrom || todayInput(),
      purchaseEffectiveTo: purchase?.effectiveTo || '',
      priceType: sell?.priceType || 'Standard',
      saleUom: sell?.saleUom || 'Each',
      sellPriceExGst: sell?.sellPriceExGst ? String(sell.sellPriceExGst) : '',
      taxCode: sell?.taxCode || 'GST',
      sellEffectiveFrom: sell?.effectiveFrom || todayInput(),
      sellEffectiveTo: sell?.effectiveTo || '',
      publishToSalesforce: sell?.publishToSalesforce ?? request.salesforceVisible,
      publishToBundle: sell?.publishToBundle ?? request.bundleEnabled,
      publishToLinenHub: sell?.publishToLinenHub ?? request.linenhubEnabled,
      customerGroupReference: sell?.customerGroupReference || '',
      branchSiteId: request.branchSiteId || '',
      sapMapping: (request.draftPayload?.sapMapping as string) || '',
      duplicateOutcome: bundle.duplicateChecks[0]?.selectedOutcome || 'NoDuplicate',
      duplicateJustification: bundle.duplicateChecks[0]?.justification || ''
    });
    setActiveTab('WORKBENCH');
  };

  const buildBundleFromForm = (status: PreviewItemRequestStatus = form.lifecycleStatus): {
    request: PreviewItemRequest;
    masterDraft: PreviewItemMasterDraft;
    purchaseDraft?: PreviewPurchasePriceDraft;
    sellDraft?: PreviewSellPriceDraft;
  } => {
    const selectedSupplier = suppliers.find(supplier => supplier.id === form.supplierId);
    const purchaseDraft: PreviewPurchasePriceDraft | undefined = form.purchaseEnabled ? {
      requestId: form.id,
      supplierId: form.supplierId || undefined,
      supplierName: selectedSupplier?.name,
      supplierItemCode: form.supplierItemCode,
      purchaseUom: form.purchaseUom,
      purchasePriceExGst: toNumber(form.purchasePriceExGst),
      purchaseCurrency: form.purchaseCurrency,
      minimumOrderQuantity: toNumber(form.minimumOrderQuantity),
      leadTimeDays: toNumber(form.leadTimeDays),
      freightHandlingCost: toNumber(form.freightHandlingCost) || 0,
      landedCost: pricing.landedCost,
      effectiveFrom: form.purchaseEffectiveFrom,
      effectiveTo: form.purchaseEffectiveTo || undefined,
      validationSummary: { isValid: true, errors: [], warnings: [] }
    } : undefined;
    const sellDraft: PreviewSellPriceDraft | undefined = form.saleEnabled ? {
      requestId: form.id,
      priceType: form.priceType,
      customerReference: isCustomerSpecificPrice ? form.customerReference : undefined,
      customerGroupReference: isGroupPrice ? form.customerGroupReference : undefined,
      saleUom: form.saleUom,
      sellPriceExGst: toNumber(form.sellPriceExGst),
      taxCode: form.taxCode,
      effectiveFrom: form.sellEffectiveFrom,
      effectiveTo: form.sellEffectiveTo || undefined,
      marginPercent: pricing.marginPercent,
      marginAmount: pricing.marginAmount,
      approvalRequired: pricing.approvalRequired,
      publishToSalesforce: form.publishToSalesforce,
      publishToBundle: form.publishToBundle,
      publishToLinenHub: form.publishToLinenHub,
      validationSummary: { isValid: true, errors: [], warnings: [] }
    } : undefined;
    const masterDraft: PreviewItemMasterDraft = {
      requestId: form.id,
      proposedSku,
      skuValidation,
      confirmedDescription: form.proposedDescription,
      itemCategory: form.itemGroup,
      productType: form.productType,
      sizeCode: form.sizeCode,
      varietyCode: form.varietyCode,
      colourCode: form.colourCode,
      gsmCode: form.gsmCode,
      rfidFlag: form.rfidFlag,
      cogFlag: form.cogFlag,
      cogCustomer: form.cogCustomer,
      itemWeight: toNumber(form.itemWeight),
      purchaseUom: form.purchaseUom,
      saleUom: form.saleUom,
      metadata: {
        mdSkuConvention: true,
        previewOnly: true
      }
    };
    const request: PreviewItemRequest = {
      id: form.id,
      requestNumber: form.requestNumber,
      requestType: form.requestType,
      lifecycleStatus: status,
      requestorUserId: currentUser?.id,
      requestorName: currentUser?.name,
      department: form.department,
      businessUnit: form.businessUnit,
      branchSiteId: form.branchSiteId || undefined,
      requiredActivationDate: form.requiredActivationDate,
      businessReason: form.businessReason,
      businessReasonDetail: form.businessReasonDetail,
      newOrReplacement: form.newOrReplacement,
      existingItemId: isReplacement ? (form.existingItemId || undefined) : undefined,
      customerReference: needsCustomerRef ? form.customerReference : undefined,
      proposedDescription: form.proposedDescription,
      itemGroup: form.itemGroup,
      division: form.division,
      purchaseEnabled: form.purchaseEnabled,
      saleEnabled: form.saleEnabled,
      bundleEnabled: form.bundleEnabled,
      linenhubEnabled: form.linenhubEnabled,
      salesforceVisible: form.salesforceVisible,
      currentMarginPercent: form.saleEnabled ? pricing.marginPercent : undefined,
      currentMarginAmount: form.saleEnabled ? pricing.marginAmount : undefined,
      draftPayload: {
        proposedSku,
        previewOnly: true,
        skuValidation,
        pricing,
        sapMapping: form.sapMapping || undefined
      },
      createdBy: currentUser?.id
    };
    request.validationSummary = validatePreviewRequestForSubmit(request, masterDraft, purchaseDraft, sellDraft);
    return { request, masterDraft, purchaseDraft, sellDraft };
  };

  const handleSave = async (status: PreviewItemRequestStatus = 'Draft') => {
    setIsSaving(true);
    try {
      const bundle = buildBundleFromForm(status);
      if (status !== 'Draft' && !bundle.request.validationSummary?.isValid) {
        warning(bundle.request.validationSummary?.errors[0] || 'Resolve validation issues before submitting.');
        return;
      }
      await itemCreationPreviewService.saveBundle(bundle, currentUser?.id);
      success(status === 'Draft' ? 'Preview draft saved.' : 'Preview request saved.');
      await loadPreview();
      setSelectedBundleId(form.id);
    } catch (err) {
      console.error(err);
      error((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateCheck = async () => {
    setIsSaving(true);
    try {
      const bundle = buildBundleFromForm('Draft');
      await itemCreationPreviewService.saveBundle(bundle, currentUser?.id);
      const candidates = findPreviewDuplicateCandidates(
        bundle.request,
        bundle.masterDraft,
        items,
        bundles.map(existing => ({
          ...existing.request,
          draftPayload: {
            ...(existing.request.draftPayload || {}),
            proposedSku: existing.masterDraft?.proposedSku
          }
        })),
        mappings,
        stockSnapshots
      );
      const highest = candidates[0]?.score || 0;
      const outcome = highest >= 1
        ? 'UseExisting'
        : highest >= 0.35
          ? form.duplicateOutcome
          : 'NoDuplicate';
      await itemCreationPreviewService.saveDuplicateCheck(form.id, {
        requestId: form.id,
        searchTerms: {
          proposedSku,
          description: form.proposedDescription,
          category: form.itemGroup,
          productType: form.productType,
          supplierId: form.supplierId,
          customerReference: form.customerReference
        },
        candidates,
        matchCount: candidates.length,
        highestMatchScore: highest,
        selectedOutcome: outcome,
        justification: form.duplicateJustification
      }, currentUser?.id);
      success(`Duplicate check completed: ${candidates.length} candidate${candidates.length === 1 ? '' : 's'} found.`);
      await loadPreview();
      setSelectedBundleId(form.id);
    } catch (err) {
      console.error(err);
      error((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    const bundle = buildBundleFromForm('Submitted');
    const persisted = bundles.find(existing => existing.request.id === form.id);
    if (!persisted?.duplicateChecks?.length) {
      warning('Run and record a duplicate check before submitting.');
      return;
    }
    if (!bundle.request.validationSummary?.isValid) {
      warning(bundle.request.validationSummary?.errors[0] || 'Resolve validation issues before submitting.');
      return;
    }
    const nextStatus: PreviewItemRequestStatus = form.saleEnabled || form.purchaseEnabled ? 'Pricing Review' : 'Data Review';
    await handleSave(nextStatus);
  };

  const handleApproval = async (bundle: PreviewItemRequestBundle, decision: 'Approve' | 'Reject') => {
    try {
      await itemCreationPreviewService.recordApprovalDecision(
        bundle.request.id,
        decision,
        currentUser?.id,
        currentUser?.name,
        decision === 'Approve' ? 'Preview approval only. No production write performed.' : 'Returned for preview revision.'
      );
      success(decision === 'Approve' ? 'Preview request approved.' : 'Preview request returned for revision.');
      await loadPreview();
    } catch (err) {
      console.error(err);
      error((err as Error).message);
    }
  };

  const handleSimulatePublication = async (
    bundle: PreviewItemRequestBundle,
    target: 'Bundle' | 'LinenHub' | 'Salesforce' | 'Internal Catalogue',
    outcome: 'success' | 'failure' | 'retry'
  ) => {
    try {
      await itemCreationPreviewService.simulatePublication(bundle, target, outcome, currentUser?.id);
      success(`${target} publication simulation recorded.`);
      await loadPreview();
    } catch (err) {
      console.error(err);
      error((err as Error).message);
    }
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setSelectedBundleId('');
    setActiveTab('WORKBENCH');
  };

  const previewCatalogue = useMemo(() => {
    const live = items
      .filter(item => item.activeFlag !== false)
      .map(item => ({
        id: item.id,
        source: 'Live',
        sku: item.sku,
        name: item.name,
        status: 'Active',
        price: item.unitPrice,
        target: 'Current PO catalogue'
      }));
    const preview = bundles
      .filter(bundle => ['Approved', 'Publishing', 'Partially Published', 'Fully Published', 'Active'].includes(bundle.request.lifecycleStatus))
      .map(bundle => ({
        id: bundle.request.id,
        source: 'Preview',
        sku: bundle.masterDraft?.proposedSku || String(bundle.request.draftPayload?.proposedSku || ''),
        name: bundle.request.proposedDescription,
        status: bundle.request.lifecycleStatus,
        price: bundle.sellDraft?.sellPriceExGst || bundle.purchaseDraft?.purchasePriceExGst || 0,
        target: [
          bundle.request.bundleEnabled ? 'Bundle' : '',
          bundle.request.linenhubEnabled ? 'LinenHub' : '',
          bundle.request.salesforceVisible ? 'Salesforce' : ''
        ].filter(Boolean).join(', ') || 'Internal'
      }));
    if (catalogueMode === 'LIVE') return live;
    if (catalogueMode === 'PREVIEW') return preview;
    return [...preview, ...live];
  }, [items, bundles, catalogueMode]);

  const shadowMetrics = useMemo(() => {
    const approved = bundles.filter(bundle => bundle.request.lifecycleStatus === 'Approved').length;
    const blockedSkus = bundles.filter(bundle => bundle.masterDraft?.skuValidation && !bundle.masterDraft.skuValidation.isValid).length;
    const belowMargin = bundles.filter(bundle => (bundle.sellDraft?.marginPercent || 100) < 25).length;
    const publicationFailures = bundles.flatMap(bundle => bundle.publicationEvents).filter(event => event.status === 'Failed').length;
    return { approved, blockedSkus, belowMargin, publicationFailures };
  }, [bundles]);

  if (!canUsePreview) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-[#1e2029] p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto text-red-500 mb-4" size={42} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Preview Access Restricted</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Item creation preview is limited to administrators and development preview users.
          </p>
        </div>
      </div>
    );
  }

  const validation = buildBundleFromForm().request.validationSummary;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <FlaskConical size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Item Creation Preview</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Isolated research workflow. Live operational tables remain untouched.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <ShieldCheck size={14} /> Preview writes only
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${config?.goLiveEnabled ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-[#1e2029] dark:text-gray-300'}`}>
            <AlertTriangle size={14} /> Go-live {config?.goLiveEnabled ? 'enabled' : 'disabled'}
          </span>
          <button
            type="button"
            onClick={loadPreview}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
        {[
          ['WORKBENCH', 'Workbench'],
          ['REQUESTS', 'Requests'],
          ['CATALOGUE', 'Preview Catalogue API'],
          ['SHADOW', 'Shadow Testing']
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as PreviewTab)}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'WORKBENCH' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Request Context</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{form.requestNumber}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(form.lifecycleStatus)}`}>
                  {form.lifecycleStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Request Type</span>
                  <select className="input-field w-full" value={form.requestType} onChange={e => setForm(prev => ({ ...prev, requestType: e.target.value as PreviewItemRequestType }))}>
                    {requestTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Department</span>
                  <select className="input-field w-full" value={form.department} onChange={e => setForm(prev => ({ ...prev, department: e.target.value }))}>
                    {departmentOptions.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Business Unit</span>
                  <select className="input-field w-full" value={form.businessUnit} onChange={e => setForm(prev => ({ ...prev, businessUnit: e.target.value }))}>
                    {businessUnitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Required Activation</span>
                  <input type="date" className="input-field w-full" value={form.requiredActivationDate} onChange={e => setForm(prev => ({ ...prev, requiredActivationDate: e.target.value }))} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Business Reason</span>
                  <select className="input-field w-full" value={form.businessReason} onChange={e => setForm(prev => ({ ...prev, businessReason: e.target.value }))}>
                    {businessReasonOptions.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">New / Replacement</span>
                  <select className="input-field w-full" value={form.newOrReplacement} onChange={e => setForm(prev => ({ ...prev, newOrReplacement: e.target.value as 'New Item' | 'Replacement', existingItemId: e.target.value === 'New Item' ? '' : prev.existingItemId }))}>
                    <option value="New Item">New Item</option>
                    <option value="Replacement">Replacement</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {isReplacement && (
                    <label className="space-y-1.5">
                      <span className="text-xs font-bold text-gray-500 uppercase">Existing Item ID <span className="text-red-500">*</span></span>
                      <input
                        list="existing-item-options"
                        className="input-field w-full"
                        placeholder="Search existing items..."
                        value={form.existingItemId}
                        onChange={e => setForm(prev => ({ ...prev, existingItemId: e.target.value }))}
                      />
                      <datalist id="existing-item-options">
                        {items.map(item => <option key={item.id} value={item.id}>{item.sku} — {item.name}</option>)}
                      </datalist>
                    </label>
                  )}
                  {needsCustomerRef && (
                    <label className="space-y-1.5">
                      <span className="text-xs font-bold text-gray-500 uppercase">Customer Reference <span className="text-red-500">*</span></span>
                      <input
                        className="input-field w-full"
                        placeholder="Customer code or name"
                        value={form.customerReference}
                        onChange={e => setForm(prev => ({ ...prev, customerReference: e.target.value }))}
                      />
                    </label>
                  )}
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-gray-500 uppercase">Branch / Site</span>
                    <input
                      className="input-field w-full"
                      placeholder="e.g. MEL, SYD, PER"
                      value={form.branchSiteId}
                      onChange={e => setForm(prev => ({ ...prev, branchSiteId: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1.5 md:col-span-3">
                    <span className="text-xs font-bold text-gray-500 uppercase">Business Reason Detail</span>
                    <textarea
                      className="input-field w-full min-h-16"
                      placeholder="Additional context or justification for this request..."
                      value={form.businessReasonDetail}
                      onChange={e => setForm(prev => ({ ...prev, businessReasonDetail: e.target.value }))}
                    />
                  </label>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Item Definition and MD SKU</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Proposed Description</span>
                  <textarea className="input-field w-full min-h-24" value={form.proposedDescription} onChange={e => setForm(prev => ({ ...prev, proposedDescription: e.target.value }))} placeholder="Controlled item description..." />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Item Group / Category</span>
                  <input list="preview-category-options" className="input-field w-full" value={form.itemGroup} onChange={e => setForm(prev => ({ ...prev, itemGroup: e.target.value }))} />
                  <datalist id="preview-category-options">
                    {categoryOptions.map(option => <option key={option} value={option} />)}
                  </datalist>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Product Type</span>
                  <input list="preview-type-options" className="input-field w-full" value={form.productType} onChange={e => setForm(prev => ({ ...prev, productType: e.target.value }))} />
                  <datalist id="preview-type-options">
                    {typeOptions.map(option => <option key={option} value={option} />)}
                  </datalist>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Size</span>
                  <input className="input-field w-full" value={form.sizeCode} onChange={e => setForm(prev => ({ ...prev, sizeCode: e.target.value }))} placeholder="Queen, King, 02, etc." />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Variety / Clothing Size</span>
                  <input className="input-field w-full" value={form.varietyCode} onChange={e => setForm(prev => ({ ...prev, varietyCode: e.target.value }))} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">Colour</span>
                  <input className="input-field w-full" value={form.colourCode} onChange={e => setForm(prev => ({ ...prev, colourCode: e.target.value }))} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">GSM / Weight Class</span>
                  <input className="input-field w-full" value={form.gsmCode} onChange={e => setForm(prev => ({ ...prev, gsmCode: e.target.value }))} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">SAP Financial Mapping</span>
                  <select className="input-field w-full" value={form.sapMapping} onChange={e => setForm(prev => ({ ...prev, sapMapping: e.target.value }))}>
                    <option value="">— None —</option>
                    {sapMappingOptions.map(code => <option key={code} value={code}>{code}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4 items-start">
                <div className={`rounded-xl border p-4 ${skuValidation.isValid ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10'}`}>
                  <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Generated MD SKU</div>
                  <div className="font-mono text-2xl font-black text-gray-900 dark:text-white">{proposedSku || 'PENDING'}</div>
                  {[...skuValidation.errors, ...skuValidation.warnings].map(message => (
                    <div key={message} className="mt-1 text-xs text-gray-600 dark:text-gray-300">{message}</div>
                  ))}
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={form.rfidFlag} onChange={e => setForm(prev => ({ ...prev, rfidFlag: e.target.checked }))} />
                    RFID enabled
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={form.cogFlag} onChange={e => setForm(prev => ({ ...prev, cogFlag: e.target.checked }))} />
                    Customer Own Goods
                  </label>
                  <input className="input-field w-full" placeholder="COG customer" value={form.cogCustomer} onChange={e => setForm(prev => ({ ...prev, cogCustomer: e.target.value }))} disabled={!form.cogFlag} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Pricing and Availability</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
                    <input type="checkbox" checked={form.purchaseEnabled} onChange={e => setForm(prev => ({ ...prev, purchaseEnabled: e.target.checked }))} />
                    Purchase pricing
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs font-bold text-gray-500 uppercase">Supplier</span>
                      <select className="input-field w-full" value={form.supplierId} disabled={!form.purchaseEnabled} onChange={e => setForm(prev => ({ ...prev, supplierId: e.target.value }))}>
                        <option value="">Select supplier</option>
                        {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">Supplier Item Code</span>
                      <input className="input-field w-full" placeholder="Supplier item code" disabled={!form.purchaseEnabled} value={form.supplierItemCode} onChange={e => setForm(prev => ({ ...prev, supplierItemCode: e.target.value }))} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">Purchase UOM</span>
                      <select className="input-field w-full" disabled={!form.purchaseEnabled} value={form.purchaseUom} onChange={e => setForm(prev => ({ ...prev, purchaseUom: e.target.value }))}>
                        {uomOptions.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">Price Ex GST</span>
                      <input className="input-field w-full" placeholder="0.00" type="number" min="0" step="0.01" disabled={!form.purchaseEnabled} value={form.purchasePriceExGst} onChange={e => setForm(prev => ({ ...prev, purchasePriceExGst: e.target.value }))} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">Freight / Handling</span>
                      <input className="input-field w-full" placeholder="0.00" type="number" min="0" step="0.01" disabled={!form.purchaseEnabled} value={form.freightHandlingCost} onChange={e => setForm(prev => ({ ...prev, freightHandlingCost: e.target.value }))} />
                    </label>
                    {pricing.landedCost !== undefined && form.purchaseEnabled && (
                      <div className="md:col-span-2 rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase">Landed Cost</span>
                        <span className="font-black text-gray-900 dark:text-white">${pricing.landedCost.toFixed(2)}</span>
                      </div>
                    )}
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">Effective From</span>
                      <input className="input-field w-full" type="date" disabled={!form.purchaseEnabled} value={form.purchaseEffectiveFrom} onChange={e => setForm(prev => ({ ...prev, purchaseEffectiveFrom: e.target.value }))} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">Effective To</span>
                      <input className="input-field w-full" type="date" disabled={!form.purchaseEnabled} value={form.purchaseEffectiveTo} onChange={e => setForm(prev => ({ ...prev, purchaseEffectiveTo: e.target.value }))} />
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
                    <input type="checkbox" checked={form.saleEnabled} onChange={e => setForm(prev => ({ ...prev, saleEnabled: e.target.checked }))} />
                    Sell pricing
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select className="input-field w-full" disabled={!form.saleEnabled} value={form.priceType} onChange={e => setForm(prev => ({ ...prev, priceType: e.target.value, customerGroupReference: '', customerReference: '' }))}>
                      {priceTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <select className="input-field w-full" disabled={!form.saleEnabled} value={form.saleUom} onChange={e => setForm(prev => ({ ...prev, saleUom: e.target.value }))}>
                      {uomOptions.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                    </select>
                    {isGroupPrice && (
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Customer Pricing Group <span className="text-red-500">*</span></span>
                        <select className="input-field w-full" disabled={!form.saleEnabled} value={form.customerGroupReference} onChange={e => setForm(prev => ({ ...prev, customerGroupReference: e.target.value }))}>
                          <option value="">— Select group —</option>
                          {customerPricingGroupOptions.map(group => <option key={group} value={group}>{group}</option>)}
                        </select>
                      </label>
                    )}
                    {isCustomerSpecificPrice && (
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Customer Reference <span className="text-red-500">*</span></span>
                        <input
                          className="input-field w-full"
                          placeholder="Customer code or contract number"
                          disabled={!form.saleEnabled}
                          value={form.customerReference}
                          onChange={e => setForm(prev => ({ ...prev, customerReference: e.target.value }))}
                        />
                      </label>
                    )}
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">Sell Price Ex GST</span>
                      <input className="input-field w-full" placeholder="0.00" type="number" min="0" step="0.01" disabled={!form.saleEnabled} value={form.sellPriceExGst} onChange={e => setForm(prev => ({ ...prev, sellPriceExGst: e.target.value }))} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">Tax Code</span>
                      <select className="input-field w-full" disabled={!form.saleEnabled} value={form.taxCode} onChange={e => setForm(prev => ({ ...prev, taxCode: e.target.value }))}>
                        {taxCodeOptions.map(taxCode => <option key={taxCode} value={taxCode}>{taxCode}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">Effective From</span>
                      <input className="input-field w-full" type="date" disabled={!form.saleEnabled} value={form.sellEffectiveFrom} onChange={e => setForm(prev => ({ ...prev, sellEffectiveFrom: e.target.value }))} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">Effective To</span>
                      <input className="input-field w-full" type="date" disabled={!form.saleEnabled} value={form.sellEffectiveTo} onChange={e => setForm(prev => ({ ...prev, sellEffectiveTo: e.target.value }))} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm font-semibold"><input type="checkbox" checked={form.bundleEnabled} onChange={e => setForm(prev => ({ ...prev, bundleEnabled: e.target.checked, publishToBundle: e.target.checked }))} /> Bundle</label>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm font-semibold"><input type="checkbox" checked={form.linenhubEnabled} onChange={e => setForm(prev => ({ ...prev, linenhubEnabled: e.target.checked, publishToLinenHub: e.target.checked }))} /> LinenHub</label>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm font-semibold"><input type="checkbox" checked={form.salesforceVisible} onChange={e => setForm(prev => ({ ...prev, salesforceVisible: e.target.checked, publishToSalesforce: e.target.checked }))} /> Salesforce</label>
                <div className={`rounded-lg border p-3 text-sm ${pricing.marginPercent < 25 && form.saleEnabled ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="text-xs font-bold uppercase">Margin</div>
                  <div className="font-black">{form.saleEnabled ? `${pricing.marginPercent.toFixed(2)}% / $${pricing.marginAmount.toFixed(2)}` : 'N/A'}</div>
                </div>
              </div>

              {showApprovalWarning && (
                <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-4 flex items-start gap-3">
                  <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-amber-800 dark:text-amber-300">Approval required — margin below threshold</div>
                    <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Current margin {pricing.marginPercent.toFixed(2)}% is below the 25% threshold. This request will be routed for commercial approval before publication.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Preview Actions</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">All actions write only to preview-prefixed tables.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold">
                    New
                  </button>
                  <button type="button" disabled={isSaving} onClick={() => handleSave('Draft')} className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold inline-flex items-center gap-2">
                    <Save size={16} /> Save Draft
                  </button>
                  <button type="button" disabled={isSaving} onClick={handleDuplicateCheck} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold inline-flex items-center gap-2">
                    <Search size={16} /> Duplicate Check
                  </button>
                  <button type="button" disabled={isSaving} onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-2">
                    <Send size={16} /> Submit Preview
                  </button>
                </div>
              </div>

              {validation && (!validation.isValid || validation.warnings.length > 0) && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 p-4">
                  {[...validation.errors, ...validation.warnings].slice(0, 6).map(message => (
                    <div key={message} className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Duplicate Result</h2>
              {latestDuplicateCheck ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 dark:bg-white/5 p-3">
                      <div className="text-xs font-bold uppercase text-gray-500">Matches</div>
                      <div className="text-xl font-black text-gray-900 dark:text-white">{latestDuplicateCheck.matchCount}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-white/5 p-3">
                      <div className="text-xs font-bold uppercase text-gray-500">Top Score</div>
                      <div className="text-xl font-black text-gray-900 dark:text-white">{(latestDuplicateCheck.highestMatchScore * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                  <select className="input-field w-full" value={form.duplicateOutcome} onChange={e => setForm(prev => ({ ...prev, duplicateOutcome: e.target.value as PreviewDuplicateOutcome }))}>
                    <option value="NoDuplicate">No duplicate found</option>
                    <option value="UseExisting">Duplicate found - use existing</option>
                    <option value="SimilarNewRequired">Similar item found - new item still required</option>
                  </select>
                  <textarea className="input-field w-full min-h-20" placeholder="Justification for similar item..." value={form.duplicateJustification} onChange={e => setForm(prev => ({ ...prev, duplicateJustification: e.target.value }))} />
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {latestDuplicateCheck.candidates.map(candidate => (
                      <div key={`${candidate.source}-${candidate.sourceId}`} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-sm text-gray-900 dark:text-white">{candidate.name}</div>
                            <div className="text-xs text-gray-500 font-mono">{candidate.sku || candidate.source}</div>
                          </div>
                          <span className="text-xs font-black text-blue-600">{(candidate.score * 100).toFixed(0)}%</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{candidate.matchType}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">Run duplicate check after entering item identity.</div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Requests</h2>
              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {bundles.slice(0, 8).map(bundle => (
                  <button
                    key={bundle.request.id}
                    type="button"
                    onClick={() => populateFromBundle(bundle)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${bundle.request.id === form.id ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-sm text-gray-900 dark:text-white truncate">{bundle.request.proposedDescription || 'Untitled request'}</div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass(bundle.request.lifecycleStatus)}`}>{bundle.request.lifecycleStatus}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 font-mono">{bundle.masterDraft?.proposedSku || bundle.request.requestNumber}</div>
                  </button>
                ))}
                {bundles.length === 0 && <div className="text-sm text-gray-500">No preview requests yet.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'REQUESTS' && (() => {
        const reviewBundle = bundles.find(b => b.request.id === reviewBundleId);
        return (
          <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-4">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Preview Request Queue</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Select a request to review and record an approval decision.</p>
                <div className="space-y-2 max-h-[640px] overflow-y-auto">
                  {bundles.map(bundle => (
                    <button
                      key={bundle.request.id}
                      type="button"
                      onClick={() => setReviewBundleId(bundle.request.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${bundle.request.id === reviewBundleId ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-sm text-gray-900 dark:text-white truncate">{bundle.request.proposedDescription || 'Untitled'}</div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${statusClass(bundle.request.lifecycleStatus)}`}>{bundle.request.lifecycleStatus}</span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{bundle.masterDraft?.proposedSku || bundle.request.requestNumber}</div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        {bundle.sellDraft && <span>{(bundle.sellDraft.marginPercent || 0).toFixed(1)}% margin</span>}
                        {bundle.sellDraft?.approvalRequired && <span className="text-amber-600 font-bold">Approval req.</span>}
                      </div>
                    </button>
                  ))}
                  {bundles.length === 0 && <div className="text-sm text-gray-500">No preview requests yet.</div>}
                </div>
              </div>
            </div>

            <div>
              {reviewBundle ? (
                <ItemApprovalReview
                  bundle={reviewBundle}
                  isSaving={isSaving}
                  onApprove={async (id, comments) => {
                    setIsSaving(true);
                    try {
                      await itemCreationPreviewService.recordApprovalDecision(id, 'Approve', currentUser?.id, currentUser?.name, comments);
                      success('Preview request approved.');
                      await loadPreview();
                    } catch (err) { error((err as Error).message); }
                    finally { setIsSaving(false); }
                  }}
                  onReject={async (id, comments) => {
                    setIsSaving(true);
                    try {
                      await itemCreationPreviewService.recordApprovalDecision(id, 'Reject', currentUser?.id, currentUser?.name, comments);
                      success('Preview request rejected.');
                      await loadPreview();
                    } catch (err) { error((err as Error).message); }
                    finally { setIsSaving(false); }
                  }}
                  onRequestRevision={async (id, comments) => {
                    setIsSaving(true);
                    try {
                      await itemCreationPreviewService.recordApprovalDecision(id, 'Escalate', currentUser?.id, currentUser?.name, comments);
                      success('Revision requested.');
                      await loadPreview();
                    } catch (err) { error((err as Error).message); }
                    finally { setIsSaving(false); }
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-12">
                  <div className="text-center">
                    <FileText className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={36} />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Select a request from the queue to review it.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === 'CATALOGUE' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Preview Catalogue API Shape</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Read-only combined view for validating future Salesforce, Bundle, and LinenHub consumption.</p>
            </div>
            <select className="input-field w-full md:w-48" value={catalogueMode} onChange={e => setCatalogueMode(e.target.value as 'COMBINED' | 'LIVE' | 'PREVIEW')}>
              <option value="COMBINED">Combined</option>
              <option value="LIVE">Live only</option>
              <option value="PREVIEW">Preview only</option>
            </select>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {previewCatalogue.slice(0, 150).map(row => (
                    <tr key={`${row.source}-${row.id}`}>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.source === 'Preview' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>{row.source}</span></td>
                      <td className="px-4 py-3 font-mono">{row.sku}</td>
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">{row.status}</td>
                      <td className="px-4 py-3">${Number(row.price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">{row.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Publication Event Queue</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Per-request simulation of publication events across external targets.</p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {bundles.filter(b => b.publicationEvents.length > 0).map(bundle => (
                <div key={bundle.request.id} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-white">{bundle.request.proposedDescription || 'Untitled'}</div>
                      <div className="text-xs text-gray-500 font-mono">{bundle.masterDraft?.proposedSku || bundle.request.requestNumber}</div>
                    </div>
                    <div className="flex gap-2">
                      {(['Bundle', 'LinenHub', 'Salesforce', 'Internal Catalogue'] as const).map(target => (
                        <button
                          key={target}
                          type="button"
                          onClick={() => handleSimulatePublication(bundle, target, 'success')}
                          className="text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 hover:bg-gray-50 dark:hover:bg-white/5"
                        >
                          + {target}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {bundle.publicationEvents.slice(0, 10).map(event => (
                      <div key={event.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">{event.targetSystem}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              event.status === 'Acknowledged' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' :
                              event.status === 'Failed' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' :
                              event.status === 'Retrying' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' :
                              'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                            }`}>{event.status}</span>
                            <span className="text-xs text-gray-400 font-mono">{event.eventType}</span>
                          </div>
                          {event.lastError && (
                            <div className="mt-1 text-xs text-red-600 dark:text-red-400 truncate">{event.lastError}</div>
                          )}
                          {event.externalItemId && (
                            <div className="mt-1 text-xs text-gray-500">External ID: {event.externalItemId}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {event.createdAt ? new Date(event.createdAt).toLocaleString() : ''} · Retries: {event.retryCount}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {event.status === 'Failed' && (
                            <button
                              type="button"
                              onClick={() => handleSimulatePublication(bundle, event.targetSystem as 'Bundle' | 'LinenHub' | 'Salesforce' | 'Internal Catalogue', 'retry')}
                              className="p-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                              title="Retry"
                            >
                              <RefreshCw size={13} />
                            </button>
                          )}
                          {event.status !== 'Acknowledged' && (
                            <button
                              type="button"
                              onClick={() => handleSimulatePublication(bundle, event.targetSystem as 'Bundle' | 'LinenHub' | 'Salesforce' | 'Internal Catalogue', 'success')}
                              className="p-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                              title="Mark acknowledged"
                            >
                              <Check size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {bundles.every(b => b.publicationEvents.length === 0) && (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No publication events yet. Approve a request and simulate publication using the buttons above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'SHADOW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5"><ClipboardCheck className="text-emerald-500 mb-3" /><div className="text-2xl font-black text-gray-900 dark:text-white">{shadowMetrics.approved}</div><div className="text-xs font-bold uppercase text-gray-500">Approved Preview</div></div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5"><AlertTriangle className="text-amber-500 mb-3" /><div className="text-2xl font-black text-gray-900 dark:text-white">{shadowMetrics.blockedSkus}</div><div className="text-xs font-bold uppercase text-gray-500">SKU Exceptions</div></div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5"><Package className="text-blue-500 mb-3" /><div className="text-2xl font-black text-gray-900 dark:text-white">{shadowMetrics.belowMargin}</div><div className="text-xs font-bold uppercase text-gray-500">Margin Exceptions</div></div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5"><XCircle className="text-red-500 mb-3" /><div className="text-2xl font-black text-gray-900 dark:text-white">{shadowMetrics.publicationFailures}</div><div className="text-xs font-bold uppercase text-gray-500">Publication Failures</div></div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Operational Shadow Scenarios</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {requestTypeOptions.map(type => {
                const count = bundles.filter(bundle => bundle.request.requestType === type).length;
                return (
                  <div key={type} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{type}</span>
                    <span className="rounded-full bg-gray-100 dark:bg-white/5 px-2 py-1 text-xs font-black">{count}</span>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => info('Dry-run production promotion is intentionally not enabled in this preview slice.')}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200"
            >
              <ShieldCheck size={16} /> Dry-run promotion remains blocked
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemCreationPreview;
