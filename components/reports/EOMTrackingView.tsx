import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Table, 
  Layers, 
  UploadCloud, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Edit3, 
  Save, 
  X, 
  DollarSign, 
  Building2, 
  TrendingUp, 
  Sparkles, 
  ChevronRight,
  Filter,
  FileText,
  ArrowRightLeft,
  ShieldCheck,
  Check,
  RefreshCw,
  Mail,
  Inbox,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext.tsx';
import { db } from '../../services/db.ts';
import { 
  LinenBudgetRecord, 
  EomMonthlyOverride, 
  PORequest,
  POStatus,
  EmailIngestionQueueItem
} from '../../types.ts';
import { 
  buildEom12MonthGrids, 
  buildPivotTabData, 
  getFinancialYearMonths, 
  calculateExGst, 
  isConcurEmailItem,
  parseConcurReportMetadata,
  parseAustralianOrIsoDate,
  enrichConcurQueueItems,
  EnrichedConcurEmailItem,
  TOTAL_DEPLETION_BUDGET,
  isClassicLinenRecord
} from '../../utils/budgetTracking.ts';
import { 
  LifecycleStageConfig, 
  getLifecycleStageByStatus 
} from '../Home.tsx';

type ActiveTab = 'TRACKING_GRID' | 'PIVOT_BREAKDOWN' | 'CONCUR_RECONCILIATION';

interface ConcurRawRow {
  prNumber: string;
  employeeName: string;
  description: string;
  poNumber: string;
  approvalStatus: string;
  submitDate: string;
  totalIncGst: number;
  totalExGst: number;
  entity: string;
  vendorName: string;
  isClassicLinen?: boolean;
}

interface ReconciliationItem {
  poNumber: string;
  prNumber: string;
  concurExGst: number;
  procureFlowExGst: number;
  variance: number;
  status: 'MATCHED' | 'AMOUNT_MISMATCH' | 'MISSING_IN_PROCUREFLOW' | 'MISSING_IN_CONCUR';
  description?: string;
  branch?: string;
  vendor?: string;
  isClassicLinen?: boolean;
  procureFlowStage?: LifecycleStageConfig | null;
  procureFlowStatus?: POStatus | null;
}

export default function EOMTrackingView() {
  const { pos, allPos, emailIngestionQueue, refreshEmailIngestionQueue, downloadInboxAttachment } = useApp();
  const effectiveAllPos = (allPos && allPos.length > 0) ? allPos : pos;
  const [activeTab, setActiveTab] = useState<ActiveTab>('TRACKING_GRID');

  // Year & Month Selection
  const [financialYears, setFinancialYears] = useState<string[]>(['FY27']);
  const [selectedFY, setSelectedFY] = useState<string>('FY27');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(2); // 1 = Jul, 2 = Aug, 3 = Sep...

  // Data from Supabase
  const [budgetRecords, setBudgetRecords] = useState<LinenBudgetRecord[]>([]);
  const [overrides, setOverrides] = useState<EomMonthlyOverride[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingOverrides, setIsSavingOverrides] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Actuals / Adjustments Mode
  const [isEditActualsMode, setIsEditActualsMode] = useState<boolean>(false);
  const [editableOverrides, setEditableOverrides] = useState<Record<string, number>>({});
  const [editableBudgets, setEditableBudgets] = useState<Record<string, number>>({});

  // Search & Filter for Pivot View
  const [pivotSearch, setPivotSearch] = useState<string>('');

  // Concur Raw Data Reconciliation State
  const [parsedConcurRows, setParsedConcurRows] = useState<ConcurRawRow[]>([]);
  const [reconciliationFilter, setReconciliationFilter] = useState<'ALL' | 'MISMATCH' | 'MISSING_PF' | 'MISSING_CONCUR' | 'MATCHED'>('ALL');
  const [concurSearchQuery, setConcurSearchQuery] = useState<string>('');

  // Automated Email Ingestion Pipeline State
  const [concurInboxEmail, setConcurInboxEmail] = useState<string>('concur-reports@splservices.com.au');
  const [isEditingInboxEmail, setIsEditingInboxEmail] = useState<boolean>(false);
  const [tempInboxEmail, setTempInboxEmail] = useState<string>('');
  const [isSavingInboxEmail, setIsSavingInboxEmail] = useState<boolean>(false);

  const [selectedEmailAttachmentId, setSelectedEmailAttachmentId] = useState<string>('');
  const [isSyncingEmail, setIsSyncingEmail] = useState<boolean>(false);
  const [syncedEmailItem, setSyncedEmailItem] = useState<EnrichedConcurEmailItem | null>(null);

  // Detect & Enrich Concur / EOM attachments in email queue with version & month intelligence
  const concurEmailAttachments: EnrichedConcurEmailItem[] = useMemo(() => {
    return enrichConcurQueueItems(emailIngestionQueue || []);
  }, [emailIngestionQueue]);

  useEffect(() => {
    if (concurEmailAttachments.length > 0 && !selectedEmailAttachmentId) {
      // Find latest for active month or fallback to newest overall
      const matchForMonth = concurEmailAttachments.find(a => a.metadata.monthIndex === selectedMonthIndex && a.isLatestForMonth);
      setSelectedEmailAttachmentId(matchForMonth ? matchForMonth.id : concurEmailAttachments[0].id);
    }
  }, [concurEmailAttachments, selectedEmailAttachmentId, selectedMonthIndex]);

  // Parse Concur workbook array buffer or blob
  const parseConcurSpreadsheetBlob = async (blob: Blob, sourceLabel: string, attachmentItem?: EnrichedConcurEmailItem) => {
    setIsSyncingEmail(true);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      
      // Select the best sheet:
      // 1. Sheet matching target month prefix (e.g. 'sep')
      // 2. Sheet matching 'raw', 'depletion', or 'spend'
      // 3. Fallback to first sheet
      const targetMonthDef = gridModel.months[selectedMonthIndex - 1];
      const monthPrefix = targetMonthDef ? targetMonthDef.label.slice(0, 3).toLowerCase() : '';
      const sheetName = workbook.SheetNames.find(s => monthPrefix && s.toLowerCase().includes(monthPrefix))
        || workbook.SheetNames.find(s => s.toLowerCase().includes('raw'))
        || workbook.SheetNames.find(s => s.toLowerCase().includes('depletion'))
        || workbook.SheetNames.find(s => s.toLowerCase().includes('spend'))
        || workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      const tsv = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
      handleParseConcurText(tsv, sheetName, attachmentItem);
      setStatusMessage({ type: 'success', text: `Successfully synced & parsed ${sourceLabel} from email intake.` });
    } catch (err: any) {
      console.error('Failed to parse Concur attachment:', err);
      setStatusMessage({ type: 'error', text: `Failed to read Concur file: ${err.message}` });
    } finally {
      setIsSyncingEmail(false);
    }
  };

  // Sync selected email attachment
  const handleSyncSelectedEmail = async (attachmentId?: string) => {
    const targetId = attachmentId || selectedEmailAttachmentId || concurEmailAttachments[0]?.id;
    if (!targetId) {
      setStatusMessage({ type: 'error', text: 'No Concur email attachment detected in queue.' });
      return;
    }
    const item = concurEmailAttachments.find(a => a.id === targetId);
    if (!item || !item.storagePath) {
      setStatusMessage({ type: 'error', text: 'Attachment storage path missing in email queue.' });
      return;
    }
    setIsSyncingEmail(true);
    try {
      const blob = await downloadInboxAttachment(item.storagePath);
      setSyncedEmailItem(item);
      await parseConcurSpreadsheetBlob(blob, `${item.attachmentName} (${item.metadata.monthLabel} ${item.metadata.versionTag})`, item);
    } catch (err: any) {
      console.error('Error downloading attachment:', err);
      setStatusMessage({ type: 'error', text: `Failed to download attachment: ${err.message}` });
      setIsSyncingEmail(false);
    }
  };

  // Auto-sync latest Concur email attachment on first visit or month switch if available
  useEffect(() => {
    if (activeTab === 'CONCUR_RECONCILIATION' && parsedConcurRows.length === 0 && concurEmailAttachments.length > 0 && !isSyncingEmail) {
      const matchForMonth = concurEmailAttachments.find(a => a.metadata.monthIndex === selectedMonthIndex && a.isLatestForMonth)
        || concurEmailAttachments.find(a => a.metadata.monthIndex === selectedMonthIndex)
        || concurEmailAttachments[0];
      if (matchForMonth) {
        setSelectedEmailAttachmentId(matchForMonth.id);
        handleSyncSelectedEmail(matchForMonth.id);
      }
    }
  }, [activeTab, concurEmailAttachments.length, selectedMonthIndex]);

  // Save Concur Inbound Email Configuration
  const handleSaveConcurInboxEmail = async () => {
    if (!tempInboxEmail.trim()) return;
    setIsSavingInboxEmail(true);
    try {
      await db.updateConcurInboundEmailConfig(tempInboxEmail.trim());
      setConcurInboxEmail(tempInboxEmail.trim());
      setIsEditingInboxEmail(false);
      setStatusMessage({ type: 'success', text: `Concur monitored mailbox updated to ${tempInboxEmail.trim()}` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to update mailbox: ${err.message}` });
    } finally {
      setIsSavingInboxEmail(false);
    }
  };

  // Budget cell change handler
  const handleBudgetCellChange = (siteCode: string, monthIndex: number, amount: number) => {
    setEditableBudgets(prev => ({
      ...prev,
      [`${siteCode}:${monthIndex}`]: amount
    }));
  };

  // Auto-balance month helper: offsets difference to Melbourne
  const handleAutoBalanceMonth = (monthIndex: number, diff: number) => {
    setEditableBudgets(prev => {
      const currentMelAlb = prev[`MEL_ALB:${monthIndex}`] ?? 261250;
      const balanced = Math.max(0, Number((currentMelAlb - diff).toFixed(2)));
      return {
        ...prev,
        [`MEL_ALB:${monthIndex}`]: balanced
      };
    });
  };

  // Load budgets and overrides
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [budgets, overrideList, inboxEmail] = await Promise.all([
        db.getLinenBudgets(),
        db.getEomMonthlyOverrides(selectedFY),
        db.getConcurInboundEmailConfig()
      ]);

      if (inboxEmail) {
        setConcurInboxEmail(inboxEmail);
      }

      if (budgets && budgets.length > 0) {
        const distinctYears = Array.from(new Set(budgets.map(b => b.financialYear))).sort();
        setFinancialYears(distinctYears);
        const yearBudgets = budgets.filter(b => b.financialYear === selectedFY);
        setBudgetRecords(yearBudgets);

        // Seed editable budgets
        const bMap: Record<string, number> = {};
        yearBudgets.forEach(b => {
          if (b.customMonthlyBudgets && Array.isArray(b.customMonthlyBudgets)) {
            b.customMonthlyBudgets.forEach((amt, idx) => {
              bMap[`${b.siteCode}:${idx + 1}`] = amt;
            });
          } else {
            for (let m = 1; m <= 12; m++) {
              bMap[`${b.siteCode}:${m}`] = b.monthlyDepletion;
            }
          }
        });
        // Seed MEL_ALB as sum of MEL and ALB
        for (let m = 1; m <= 12; m++) {
          const mel = bMap[`MEL:${m}`] || 0;
          const alb = bMap[`ALB:${m}`] || 0;
          bMap[`MEL_ALB:${m}`] = Number((mel + alb).toFixed(2));
        }
        setEditableBudgets(bMap);
      }
      setOverrides(overrideList || []);

      // Seed editable overrides dictionary
      const map: Record<string, number> = {};
      (overrideList || []).forEach(o => {
        map[`${o.siteCode}:${o.monthIndex}:${o.spendType}`] = o.overrideAmount;
      });
      setEditableOverrides(map);
    } catch (err: any) {
      console.error('Error loading EOM data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFY]);

  // Compute 12-Month Tracking Grid Model with live budget & actuals edits
  const gridModel = useMemo(() => {
    // If in edit mode, create synthetic overrides
    const effectiveOverrides: EomMonthlyOverride[] = isEditActualsMode
      ? Object.entries(editableOverrides).map(([key, val]) => {
          const [siteCode, mIdxStr, spendType] = key.split(':');
          return {
            financialYear: selectedFY,
            siteCode,
            monthIndex: parseInt(mIdxStr, 10),
            spendType: spendType as 'DEPLETION' | 'NEW_BUSINESS',
            overrideAmount: val
          };
        })
      : overrides;

    // Apply live editable budgets to records
    const effectiveBudgetRecords: LinenBudgetRecord[] = isEditActualsMode
      ? budgetRecords.map(b => {
          const customSpread = [...(b.customMonthlyBudgets || Array(12).fill(b.monthlyDepletion))];
          const albRecord = budgetRecords.find(x => x.siteCode === 'ALB');
          const albMonthly = albRecord?.monthlyDepletion || 40083.33;
          for (let m = 1; m <= 12; m++) {
            if (b.siteCode === 'MEL') {
              const melAlb = editableBudgets[`MEL_ALB:${m}`];
              if (melAlb !== undefined) {
                customSpread[m - 1] = Math.max(0, Number((melAlb - albMonthly).toFixed(2)));
              }
            } else if (editableBudgets[`${b.siteCode}:${m}`] !== undefined) {
              customSpread[m - 1] = Number(editableBudgets[`${b.siteCode}:${m}`].toFixed(2));
            }
          }
          return { ...b, customMonthlyBudgets: customSpread };
        })
      : budgetRecords;

    return buildEom12MonthGrids(
      effectiveAllPos,
      effectiveBudgetRecords,
      effectiveOverrides,
      selectedFY,
      selectedMonthIndex
    );
  }, [effectiveAllPos, budgetRecords, overrides, editableOverrides, editableBudgets, isEditActualsMode, selectedFY, selectedMonthIndex]);

  // Compute Pivot Tab Data Model
  const pivotModel = useMemo(() => {
    return buildPivotTabData(effectiveAllPos, selectedMonthIndex, selectedFY);
  }, [effectiveAllPos, selectedMonthIndex, selectedFY]);

  // Filtered detailed PRs in Pivot View
  const filteredPivotPrs = useMemo(() => {
    if (!pivotSearch.trim()) return pivotModel.detailedPrs;
    const q = pivotSearch.toLowerCase();
    return pivotModel.detailedPrs.filter(
      p => p.prNumber.toLowerCase().includes(q) ||
           p.poNumber.toLowerCase().includes(q) ||
           p.business.toLowerCase().includes(q) ||
           p.reason.toLowerCase().includes(q)
    );
  }, [pivotModel.detailedPrs, pivotSearch]);

  // Save manual overrides and site monthly budgets
  const handleSaveOverrides = async () => {
    setIsSavingOverrides(true);
    try {
      // 1. Validate monthly budget balancing: sum of sites must equal monthly baseline budget for all months
      const baselineMonthlyDepletion = Math.round(TOTAL_DEPLETION_BUDGET / 12); // $826,750
      const trackingSiteCodes = ['MEL_ALB', 'SYD', 'ADL', 'BNE', 'CNS', 'MKY', 'PER'];
      for (let m = 1; m <= 12; m++) {
        let monthSum = 0;
        trackingSiteCodes.forEach(code => {
          const val = editableBudgets[`${code}:${m}`];
          if (val !== undefined) {
            monthSum += val;
          } else {
            const r = gridModel.depletionRows.find(row => row.siteCode === code);
            monthSum += (r ? r.monthlyBudgets[m - 1] : 0);
          }
        });
        const diff = Math.abs(monthSum - baselineMonthlyDepletion);
        if (diff > 1) {
          const monthLabel = gridModel.months[m - 1]?.label || `Month ${m}`;
          setStatusMessage({
            type: 'error',
            text: `Cannot save: ${monthLabel} site budgets sum to ${formatAUD(monthSum)}, which does not match the required monthly total of ${formatAUD(baselineMonthlyDepletion)} (Variance: ${formatAUD(monthSum - baselineMonthlyDepletion)}). Click 'Auto-bal' on ${monthLabel} or adjust allocations.`
          });
          setIsSavingOverrides(false);
          return;
        }
      }

      // 2. Persist updated custom monthly budgets to linen_budgets (preserving baseline annual & monthly depletion)
      if (budgetRecords.length > 0) {
        const albRecord = budgetRecords.find(b => b.siteCode === 'ALB');
        const albMonthly = albRecord?.monthlyDepletion || 40083.33;

        const updatedRecords: LinenBudgetRecord[] = budgetRecords.map(b => {
          const customSpread = [...(b.customMonthlyBudgets || Array(12).fill(b.monthlyDepletion))];
          for (let m = 1; m <= 12; m++) {
            if (b.siteCode === 'MEL') {
              const melAlbVal = editableBudgets[`MEL_ALB:${m}`];
              if (melAlbVal !== undefined) {
                customSpread[m - 1] = Math.max(0, Number((melAlbVal - albMonthly).toFixed(2)));
              }
            } else if (editableBudgets[`${b.siteCode}:${m}`] !== undefined) {
              customSpread[m - 1] = Number(editableBudgets[`${b.siteCode}:${m}`].toFixed(2));
            }
          }
          return {
            ...b,
            customMonthlyBudgets: customSpread
          };
        });
        await db.saveLinenBudget(updatedRecords);
      }

      // 3. Save actuals overrides
      const overridePromises = Object.entries(editableOverrides).map(([key, val]) => {
        const [siteCode, mIdxStr, spendType] = key.split(':');
        return db.upsertEomMonthlyOverride({
          financialYear: selectedFY,
          siteCode,
          monthIndex: parseInt(mIdxStr, 10),
          spendType: spendType as 'DEPLETION' | 'NEW_BUSINESS',
          overrideAmount: Number(val) || 0
        });
      });
      await Promise.all(overridePromises);

      await loadData();
      setIsEditActualsMode(false);
      setStatusMessage({ type: 'success', text: 'Successfully saved site monthly budgets and adjustments.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to save: ${err.message}` });
    } finally {
      setIsSavingOverrides(false);
    }
  };

  // Helper formatters
  const formatAUD = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    return '$' + Math.round(val).toLocaleString('en-AU');
  };

  const formatAUDExact = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '$0.00';
    return '$' + val.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Parse Concur text from automated intake
  const handleParseConcurText = (rawText?: string, sheetName: string = '', activeItem?: EnrichedConcurEmailItem) => {
    if (!rawText || !rawText.trim()) return;

    const lines = rawText.trim().split(/\r?\n/);
    if (lines.length < 2) return;

    const header = lines[0].split('\t').length > 1 ? lines[0].split('\t') : lines[0].split(',');
    const cleanHeader = header.map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

    const prIdx = cleanHeader.findIndex(h => h.includes('purchase request') || h.includes('pr'));
    const descIdx = cleanHeader.findIndex(h => h.includes('description'));
    const poIdx = cleanHeader.findIndex(h => h.includes('po') || h.includes('purchase order'));
    const totalIdx = cleanHeader.findIndex(h => h === 'total' || h.includes('total inc') || (h.includes('total') && !h.includes('excl')));
    const exclGstIdx = cleanHeader.findIndex(h => h.includes('excl gst') || h.includes('ex gst') || h.includes('net amount') || h.includes('subtotal'));
    const empIdx = cleanHeader.findIndex(h => h.includes('employee'));
    const branchIdx = cleanHeader.findIndex(h => h === 'branch' || h.startsWith('branch'));
    const entityIdx = cleanHeader.findIndex(h => h.includes('entity') || h.includes('site') || (h.includes('branch') && h !== 'branch'));
    const vendorIdx = cleanHeader.findIndex(h => h.includes('vendor') || h.includes('supplier'));
    const statusIdx = cleanHeader.findIndex(h => h.includes('status'));
    const dateIdx = cleanHeader.findIndex(h => h.includes('date'));

    const parsed: ConcurRawRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split('\t').length > 1 ? line.split('\t') : line.split(',');
      const getVal = (idx: number) => (idx >= 0 && cols[idx] ? cols[idx].trim().replace(/^"|"$/g, '') : '');

      const prNumber = getVal(prIdx);
      const poNumber = getVal(poIdx);
      const description = getVal(descIdx);
      const branchVal = branchIdx >= 0 && getVal(branchIdx) ? getVal(branchIdx) : getVal(entityIdx);

      // Helper to check if a value is formatted currency or purely numbers with decimal/currency (e.g. "$258,424.57")
      const isCurrencyOrAmount = (val: string) => {
        const v = val.trim();
        return (v.startsWith('$') || v.includes(',')) && /^\$?\s*[\d,]+(\.\d{1,2})?$/.test(v);
      };

      const hasTotalWord = cols.some(c => {
        const lower = c.trim().toLowerCase();
        return lower === 'total' || lower === 'grand total' || lower === 'report total' || lower.startsWith('total ') || lower === 'sum' || lower === 'summary';
      });

      // Valid Concur PR numbers are sequential integer IDs (e.g. 9848) or alphanumeric codes (e.g. PR-9848), never currency amounts
      const isPrCorruptedByCurrency = isCurrencyOrAmount(prNumber);
      const isEntityCorruptedByCurrency = isCurrencyOrAmount(branchVal);

      // Exclude summary / total lines that lack legitimate PO or PR numbers or are Excel summary footers
      const isSummaryRow = hasTotalWord ||
                           (!poNumber && !prNumber) ||
                           (!poNumber && isPrCorruptedByCurrency) ||
                           isEntityCorruptedByCurrency ||
                           (!poNumber && !description && !getVal(vendorIdx)) ||
                           description.toLowerCase().includes('total') ||
                           branchVal.toLowerCase().includes('total') ||
                           prNumber.toLowerCase().includes('total');
      if (isSummaryRow) continue;

      const cleanPr = prNumber.replace(/^[#\s]+|^PR-?/i, '').trim();

      // Check if this record belongs to Classic Linen
      const isCL = isClassicLinenRecord(description, branchVal, poNumber);
      const resolvedEntity = isCL ? 'Classic Linen' : (branchVal || getVal(entityIdx));

      const totalRaw = (totalIdx >= 0 ? getVal(totalIdx) : '').replace(/[\$,]/g, '');
      const totalIncGst = parseFloat(totalRaw) || 0;

      let totalExGst = 0;
      if (exclGstIdx >= 0) {
        const exclRaw = getVal(exclGstIdx).replace(/[\$,]/g, '');
        const parsedExcl = parseFloat(exclRaw);
        if (!isNaN(parsedExcl) && parsedExcl > 0) {
          totalExGst = Number(parsedExcl.toFixed(2));
        }
      }
      if (totalExGst === 0 && totalIncGst > 0) {
        totalExGst = calculateExGst(totalIncGst);
      }

      parsed.push({
        prNumber: cleanPr || prNumber,
        employeeName: getVal(empIdx),
        description,
        poNumber,
        approvalStatus: getVal(statusIdx) || 'Approved',
        submitDate: getVal(dateIdx),
        totalIncGst,
        totalExGst,
        entity: resolvedEntity,
        vendorName: getVal(vendorIdx),
        isClassicLinen: isCL
      });
    }

    setParsedConcurRows(parsed);

    // Auto-detect report month and synchronize selectedMonthIndex if different
    const currentItem = activeItem || syncedEmailItem;
    const meta = parseConcurReportMetadata(
      currentItem?.attachmentName || '',
      currentItem?.subject || sheetName || '',
      parsed,
      sheetName
    );
    if (meta.monthIndex && meta.monthIndex !== selectedMonthIndex) {
      setSelectedMonthIndex(meta.monthIndex);
    }

    setStatusMessage({ type: 'success', text: `Successfully parsed ${parsed.length} Concur records for ${meta.monthLabel} (${meta.versionTag}).` });
  };

  // Run automated reconciliation between Concur and ProcureFlow scoped strictly to the active selected month
  const reconciliationResults = useMemo((): {
    items: ReconciliationItem[];
    concurTotalEx: number;
    pfTotalEx: number;
    netVariance: number;
    matchCount: number;
    mismatchCount: number;
    missingInPfCount: number;
    missingInConcurCount: number;
    parityPercent: number;
    targetMonthLabel: string;
  } => {
    const targetMonthDef = gridModel.months[selectedMonthIndex - 1] || gridModel.months[1];
    const targetCalMonth = targetMonthDef?.calendarMonth || 9;
    const targetCalYear = targetMonthDef?.calendarYear || 2026;
    const targetMonthLabel = targetMonthDef?.label || 'Sep-26';

    // 1. Filter parsed Concur rows strictly to the target month & year (or include if no specific date row is present)
    const monthConcurRows = parsedConcurRows.filter(c => {
      // Exclude corrupted summary rows defensively
      if (!c.poNumber && (!c.prNumber || c.prNumber.includes('$') || c.prNumber.includes(','))) return false;
      if (!c.submitDate) return true;
      const d = parseAustralianOrIsoDate(c.submitDate);
      if (!d) return true;
      return (d.getMonth() + 1 === targetCalMonth) && (d.getFullYear() === targetCalYear);
    });

    // Extract quick lookup sets from Concur rows for bidirectional cross-month linkage
    const concurPrSet = new Set(
      monthConcurRows
        .map(c => (c.prNumber || '').replace(/^[#\s]+|^PR-?/i, '').toUpperCase().trim())
        .filter(Boolean)
    );
    const concurPoSet = new Set(
      monthConcurRows
        .map(c => (c.poNumber || '').toUpperCase().trim())
        .filter(Boolean)
    );

    // 2. Filter ProcureFlow POs across the enterprise (effectiveAllPos) for this reconciliation
    // Strictly include approved requests only (Stage 2: at PR# stage and beyond).
    // Requisitions before Stage 2 (DRAFT, PENDING_APPROVAL, REJECTED) are not yet approved
    // and therefore cannot be missing in Concur or counted in reconciliation.
    const monthPos = effectiveAllPos.filter(p => {
      if (p.status === 'REJECTED' || p.status === 'DRAFT' || p.status === 'PENDING_APPROVAL') return false;

      // Match A: PO directly linked to this month's Concur PO# or PR#
      const pConcurPo = (p.concurPoNumber || '').toUpperCase().trim();
      const pDisplay = (p.displayId || '').toUpperCase().trim();
      const pReqNum = (p.concurRequestNumber || '').replace(/^[#\s]+|^PR-?/i, '').toUpperCase().trim();
      const pLinesConcurPos = (p.lines || []).map(l => (l.concurPoNumber || '').toUpperCase().trim());

      const hasDirectConcurMatch = 
        (pConcurPo && concurPoSet.has(pConcurPo)) ||
        (pDisplay && concurPoSet.has(pDisplay)) ||
        (pReqNum && (concurPrSet.has(pReqNum) || concurPoSet.has(pReqNum))) ||
        pLinesConcurPos.some(lp => lp && concurPoSet.has(lp));

      if (hasDirectConcurMatch) return true;

      // Match B: Strict Calendar month & year match
      const dateStr = p.requestDate || (p as any).submitDate || p.createdAt;
      if (!dateStr) return false;
      const d = parseAustralianOrIsoDate(dateStr);
      if (!d) return false;
      const isSameMonth = (d.getMonth() + 1 === targetCalMonth) && (d.getFullYear() === targetCalYear);
      if (isSameMonth) return true;

      // Match C: Tail of prior month for next month replenishment (e.g. Aug 25-31 for Sep)
      // Especially for Classic Linen and major linen orders placed at end of prior month
      const prevCalMonth = targetCalMonth === 1 ? 12 : targetCalMonth - 1;
      const prevCalYear = targetCalMonth === 1 ? targetCalYear - 1 : targetCalYear;
      if (d.getMonth() + 1 === prevCalMonth && d.getFullYear() === prevCalYear && d.getDate() >= 24) {
        const text = `${p.comments || ''} ${p.reasonForRequest || ''} ${p.customerName || ''}`.toUpperCase();
        const shortMonth = (targetMonthDef?.shortMonth || '').toUpperCase();
        if (text.includes(shortMonth) || p.site?.toLowerCase().includes('classic') || p.siteId === '88888888-8888-4888-8888-888888888888') {
          return true;
        }
      }

      return false;
    });

    if (monthConcurRows.length === 0 && monthPos.length === 0) {
      return {
        items: [],
        concurTotalEx: 0,
        pfTotalEx: 0,
        netVariance: 0,
        matchCount: 0,
        mismatchCount: 0,
        missingInPfCount: 0,
        missingInConcurCount: 0,
        parityPercent: 100,
        targetMonthLabel
      };
    }

    // Build ProcureFlow PO Map for the selected month with normalized keys
    const pfMap = new Map<string, PORequest>();
    monthPos.forEach(p => {
      const rawKeys = [
        p.concurPoNumber,
        p.displayId,
        p.id,
        p.concurRequestNumber,
        ...(p.lines || []).map(l => l.concurPoNumber)
      ].filter(Boolean) as string[];

      rawKeys.forEach(k => {
        const norm = k.toUpperCase().trim();
        pfMap.set(norm, p);
        const bare = norm.replace(/^[#\s]+|^PR-?/i, '').trim();
        if (bare) {
          pfMap.set(bare, p);
          pfMap.set('#' + bare, p);
          pfMap.set('PR' + bare, p);
          pfMap.set('PR-' + bare, p);
        }
      });
    });

    const items: ReconciliationItem[] = [];
    const matchedPfIds = new Set<string>();

    let concurTotalEx = 0;
    let pfTotalEx = 0;
    let matchCount = 0;
    let mismatchCount = 0;
    let missingInPfCount = 0;

    monthConcurRows.forEach(c => {
      concurTotalEx += c.totalExGst;
      const keyPo = (c.poNumber || '').toUpperCase().trim();
      const keyPr = (c.prNumber || '').toUpperCase().trim();
      const cleanPr = keyPr.replace(/^[#\s]+|^PR-?/i, '').trim();

      let matchedPO = pfMap.get(keyPo) || pfMap.get(keyPr) || (cleanPr ? pfMap.get(cleanPr) : undefined);

      // Heuristic fallback for Classic Linen: If not matched by exact ID, search unmatched Classic Linen POs by vendor and amount
      const isCL = c.isClassicLinen || isClassicLinenRecord(c.description, c.entity, c.poNumber, matchedPO?.site);
      if (!matchedPO && isCL) {
        const clCandidates = monthPos.filter(p => 
          !matchedPfIds.has(p.id) && 
          (p.site?.toLowerCase().includes('classic') || p.siteId === '88888888-8888-4888-8888-888888888888')
        );

        const vendorMatch = clCandidates.find(p => {
          const pSupplier = (p.supplierName || '').toLowerCase();
          const cVendor = (c.vendorName || '').toLowerCase();
          const isVendorSimilar = pSupplier.includes(cVendor) || cVendor.includes(pSupplier) ||
            (cVendor.includes('simba') && pSupplier.includes('simba')) ||
            (cVendor.includes('host') && pSupplier.includes('host')) ||
            (cVendor.includes('global textile') && pSupplier.includes('global textile')) ||
            (cVendor.includes('cy international') && pSupplier.includes('cy'));
          if (!isVendorSimilar) return false;
          const pfEx = p.subtotalAmount || p.totalAmount || calculateExGst(p.totalAmountIncGst || 0);
          return Math.abs(c.totalExGst - pfEx) <= 50;
        });

        if (vendorMatch) {
          matchedPO = vendorMatch;
        }
      }

      const isResolvedCL = isCL || (matchedPO && (matchedPO.site?.toLowerCase().includes('classic') || matchedPO.siteId === '88888888-8888-4888-8888-888888888888'));
      const displayBranch = isResolvedCL ? 'Classic Linen (SYD)' : (c.entity || matchedPO?.site || 'SYD');

      if (matchedPO) {
        matchedPfIds.add(matchedPO.id);
        const pfEx = matchedPO.subtotalAmount || matchedPO.totalAmount || calculateExGst(matchedPO.totalAmountIncGst || 0);
        pfTotalEx += pfEx;
        const diff = Number((c.totalExGst - pfEx).toFixed(2));
        const pfStage = getLifecycleStageByStatus(matchedPO.status);

        if (Math.abs(diff) <= 0.05) {
          matchCount++;
          items.push({
            poNumber: c.poNumber || matchedPO.concurPoNumber || matchedPO.displayId,
            prNumber: c.prNumber || matchedPO.concurRequestNumber || '',
            concurExGst: c.totalExGst,
            procureFlowExGst: pfEx,
            variance: 0,
            status: 'MATCHED',
            description: c.description || matchedPO.comments,
            branch: displayBranch,
            vendor: c.vendorName || matchedPO.supplierName,
            isClassicLinen: isResolvedCL,
            procureFlowStage: pfStage,
            procureFlowStatus: matchedPO.status
          });
        } else {
          mismatchCount++;
          items.push({
            poNumber: c.poNumber || matchedPO.concurPoNumber || matchedPO.displayId,
            prNumber: c.prNumber || matchedPO.concurRequestNumber || '',
            concurExGst: c.totalExGst,
            procureFlowExGst: pfEx,
            variance: diff,
            status: 'AMOUNT_MISMATCH',
            description: c.description || matchedPO.comments,
            branch: displayBranch,
            vendor: c.vendorName || matchedPO.supplierName,
            isClassicLinen: isResolvedCL,
            procureFlowStage: pfStage,
            procureFlowStatus: matchedPO.status
          });
        }
      } else {
        missingInPfCount++;
        items.push({
          poNumber: c.poNumber || 'UNKNOWN',
          prNumber: c.prNumber || '',
          concurExGst: c.totalExGst,
          procureFlowExGst: 0,
          variance: c.totalExGst,
          status: 'MISSING_IN_PROCUREFLOW',
          description: c.description,
          branch: displayBranch,
          vendor: c.vendorName,
          isClassicLinen: isResolvedCL,
          procureFlowStage: null,
          procureFlowStatus: null
        });
      }
    });

    // Check for ProcureFlow approved POs in this month missing in Concur
    let missingInConcurCount = 0;
    monthPos.forEach(p => {
      if (!matchedPfIds.has(p.id)) {
        const pfEx = p.subtotalAmount || p.totalAmount || calculateExGst(p.totalAmountIncGst || 0);
        missingInConcurCount++;
        const isCL = isClassicLinenRecord(p.comments, p.site, p.concurPoNumber, p.site) ||
                     p.site?.toLowerCase().includes('classic') ||
                     p.siteId === '88888888-8888-4888-8888-888888888888';
        const displayBranch = isCL ? 'Classic Linen (SYD)' : p.site;
        const pfStage = getLifecycleStageByStatus(p.status);

        items.push({
          poNumber: p.concurPoNumber || p.displayId,
          prNumber: p.concurRequestNumber || '',
          concurExGst: 0,
          procureFlowExGst: pfEx,
          variance: -pfEx,
          status: 'MISSING_IN_CONCUR',
          description: p.comments || p.reasonForRequest,
          branch: displayBranch,
          vendor: p.supplierName,
          isClassicLinen: isCL,
          procureFlowStage: pfStage,
          procureFlowStatus: p.status
        });
      }
    });

    const netVariance = Number((concurTotalEx - pfTotalEx).toFixed(2));
    const totalItems = items.length;
    const parityPercent = totalItems > 0 ? Number(((matchCount / totalItems) * 100).toFixed(1)) : 100;

    return {
      items,
      concurTotalEx,
      pfTotalEx,
      netVariance,
      matchCount,
      mismatchCount,
      missingInPfCount,
      missingInConcurCount,
      parityPercent,
      targetMonthLabel
    };
  }, [parsedConcurRows, effectiveAllPos, selectedMonthIndex, selectedFY, gridModel.months]);

  // Filtered reconciliation drilldown
  const filteredReconciliationItems = useMemo(() => {
    let list = reconciliationResults.items;
    if (reconciliationFilter === 'MISMATCH') list = list.filter(i => i.status === 'AMOUNT_MISMATCH');
    else if (reconciliationFilter === 'MISSING_PF') list = list.filter(i => i.status === 'MISSING_IN_PROCUREFLOW');
    else if (reconciliationFilter === 'MISSING_CONCUR') list = list.filter(i => i.status === 'MISSING_IN_CONCUR');
    else if (reconciliationFilter === 'MATCHED') list = list.filter(i => i.status === 'MATCHED');

    if (concurSearchQuery.trim()) {
      const q = concurSearchQuery.toLowerCase();
      list = list.filter(i => 
        i.poNumber.toLowerCase().includes(q) ||
        i.prNumber.toLowerCase().includes(q) ||
        (i.branch && i.branch.toLowerCase().includes(q)) ||
        (i.vendor && i.vendor.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.isClassicLinen && (q.includes('cl') || q.includes('classic') || q.includes('linen') || q.includes('syd'))) ||
        (i.procureFlowStage && (
          i.procureFlowStage.label.toLowerCase().includes(q) ||
          i.procureFlowStage.stageTitle.toLowerCase().includes(q) ||
          i.procureFlowStage.shortLabel.toLowerCase().includes(q) ||
          q === `stage ${i.procureFlowStage.num}` ||
          q === `s${i.procureFlowStage.num}`
        ))
      );
    }
    return list;
  }, [reconciliationResults.items, reconciliationFilter, concurSearchQuery]);

  // Export Parity Audit to Excel
  const handleExportReconciliationExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['Concur vs ProcureFlow Parity Reconciliation Audit'],
      ['Export Date', new Date().toLocaleDateString('en-AU')],
      ['Report Source', syncedEmailItem ? `Email: ${syncedEmailItem.attachmentName}` : 'Spreadsheet'],
      [''],
      ['Metric', 'Value'],
      ['Parity Match Rate', `${reconciliationResults.parityPercent}%`],
      ['Concur Total (Ex-GST)', reconciliationResults.concurTotalEx],
      ['ProcureFlow Matched (Ex-GST)', reconciliationResults.pfTotalEx],
      ['Net Variance', reconciliationResults.netVariance],
      ['Matched POs', reconciliationResults.matchCount],
      ['Amount Mismatches', reconciliationResults.mismatchCount],
      ['Missing in ProcureFlow', reconciliationResults.missingInPfCount],
      ['Missing in Concur', reconciliationResults.missingInConcurCount]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Parity Summary');

    const auditData: any[] = [
      ['Status', 'PF Stage', 'PO Number', 'PR Number', 'Concur Ex-GST ($)', 'ProcureFlow Ex-GST ($)', 'Variance ($)', 'Branch', 'Description', 'Vendor']
    ];
    reconciliationResults.items.forEach(i => {
      auditData.push([
        i.status,
        i.procureFlowStage ? `Stage ${i.procureFlowStage.num} - ${i.procureFlowStage.label}` : (i.status === 'MISSING_IN_PROCUREFLOW' ? 'Not in PF' : '-'),
        i.poNumber,
        i.prNumber || '',
        i.concurExGst,
        i.procureFlowExGst,
        i.variance,
        i.branch || '',
        i.description || '',
        i.vendor || ''
      ]);
    });
    const wsAudit = XLSX.utils.aoa_to_sheet(auditData);
    XLSX.utils.book_append_sheet(wb, wsAudit, 'Audit Details');

    XLSX.writeFile(wb, `Concur_ProcureFlow_Parity_Audit_${selectedFY}.xlsx`);
  };

  // Export EOM Tracking Grid to Excel
  const handleExportGridExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Depletion Sheet
    const depData: any[] = [
      ['DEPLETION (ACC + HC, Excl. GST) - ' + selectedFY],
      ['Location', ...gridModel.months.map(m => m.label), 'BALANCE YTG', 'SPEND YTD %']
    ];
    gridModel.depletionRows.forEach(r => {
      depData.push([r.siteName, ...r.monthlyActuals.map(v => v !== null ? v : ''), r.balanceYtg, `${r.spendYtdPercent}%`]);
      depData.push(['MNTH $BUDGET', ...r.monthlyBudgets, '', '']);
    });
    depData.push(['TOTAL', ...gridModel.depletionTotalRow.monthlyActuals.map(v => v !== null ? v : ''), gridModel.depletionTotalRow.balanceYtg, `${gridModel.depletionTotalRow.spendYtdPercent}%`]);

    const wsDep = XLSX.utils.aoa_to_sheet(depData);
    XLSX.utils.book_append_sheet(wb, wsDep, 'Depletion');

    // 2. New Business Sheet
    const nbData: any[] = [
      ['NEW BUSINESS (ACC + HC, Excl. GST) - ' + selectedFY],
      ['Location', ...gridModel.months.map(m => m.label), 'BALANCE YTG']
    ];
    gridModel.newBusinessRows.forEach(r => {
      nbData.push([r.siteName, ...r.monthlyActuals.map(v => v !== null ? v : ''), r.balanceYtg]);
      nbData.push(['MNTH $BUDGET', ...r.monthlyBudgets, '']);
    });
    nbData.push(['TOTAL', ...gridModel.newBusinessTotalRow.monthlyActuals.map(v => v !== null ? v : ''), gridModel.newBusinessTotalRow.balanceYtg]);

    const wsNb = XLSX.utils.aoa_to_sheet(nbData);
    XLSX.utils.book_append_sheet(wb, wsNb, 'New Business');

    XLSX.writeFile(wb, `ProcureFlow_EOM_Tracking_${selectedFY}.xlsx`);
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      {/* ── TOP HEADER & TAB SWITCHER ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <FileSpreadsheet size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider text-gray-900 dark:text-white">
                End of Month (EOM) Spend &amp; Reconciliation
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Financial governance model replicating the Ash/Concur month-end spreadsheet with live ProcureFlow PO integration.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Tab Segmented Toggle */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs font-black uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setActiveTab('TRACKING_GRID')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                activeTab === 'TRACKING_GRID'
                  ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <Table size={14} />
              <span>Tracking vs Budget</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PIVOT_BREAKDOWN')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                activeTab === 'PIVOT_BREAKDOWN'
                  ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <Layers size={14} />
              <span>Pivot Tab</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CONCUR_RECONCILIATION')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                activeTab === 'CONCUR_RECONCILIATION'
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <ArrowRightLeft size={14} />
              <span>Concur Audit</span>
            </button>
          </div>

          {/* FY Selector */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <span className="text-xs font-bold text-gray-500">FY:</span>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="bg-transparent text-sm font-black text-gray-900 dark:text-white outline-none cursor-pointer"
            >
              {financialYears.map(fy => (
                <option key={fy} value={fy} className="text-gray-900 dark:text-gray-100 dark:bg-gray-800">
                  {fy}
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <span className="text-xs font-bold text-gray-500">Month:</span>
            <select
              value={selectedMonthIndex}
              onChange={(e) => {
                const newMonth = parseInt(e.target.value, 10);
                setSelectedMonthIndex(newMonth);
                const matchForMonth = concurEmailAttachments.find(a => a.metadata.monthIndex === newMonth && a.isLatestForMonth)
                  || concurEmailAttachments.find(a => a.metadata.monthIndex === newMonth);
                if (matchForMonth && matchForMonth.id !== selectedEmailAttachmentId) {
                  setSelectedEmailAttachmentId(matchForMonth.id);
                  handleSyncSelectedEmail(matchForMonth.id);
                }
              }}
              className="bg-transparent text-sm font-black text-gray-900 dark:text-white outline-none cursor-pointer"
            >
              {gridModel.months.map(m => (
                <option key={m.monthIndex} value={m.monthIndex} className="text-gray-900 dark:text-gray-100 dark:bg-gray-800">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExportGridExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 rounded-xl border border-gray-300 dark:border-gray-700 transition-all shadow-sm"
          >
            <Download size={14} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* ── STATUS MESSAGE ─────────────────────────────────────────────────── */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl flex items-center justify-between border ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20'
        }`}>
          <div className="flex items-center gap-3">
            {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-xs font-bold">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-black hover:opacity-70">Dismiss</button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: TRACKING VS MONTHLY BUDGET                                    */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === 'TRACKING_GRID' && (
        <div className="space-y-6">
          {/* Subheader: Edit Actuals Mode Toggle */}
          <div className="flex items-center justify-between bg-white dark:bg-[#1c1f2b] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                Data Mode:
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Live ProcureFlow Aggregation
              </span>
              {overrides.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  {overrides.length} Manual Adjustment(s) Active
                </span>
              )}
            </div>

            {!isEditActualsMode ? (
              <button
                type="button"
                onClick={() => setIsEditActualsMode(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 rounded-xl border border-indigo-500/20 transition-all"
              >
                <Edit3 size={14} />
                <span>Edit Actuals / Input Adjustments</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditActualsMode(false)}
                  className="px-3 py-1.5 text-xs font-black uppercase text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveOverrides}
                  disabled={isSavingOverrides}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md"
                >
                  {isSavingOverrides ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Adjustments</span>
                </button>
              </div>
            )}
          </div>

          {/* TWO COLUMN WORKBOOK SPLIT */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* ── LEFT COLUMN: BUDGET & YTD SUMMARIES (4 cols) ──────────────── */}
            <div className="xl:col-span-4 space-y-6">
              {/* CURRENT $BUDGET TABLE */}
              <div className="bg-white dark:bg-[#1c1f2b] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                    CURRENT $BUDGET {selectedFY}
                  </h3>
                  <span className="text-[10px] font-bold text-gray-400">Baseline Annual / Monthly</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/80 font-black text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                        <th className="py-2.5 px-3">Location</th>
                        <th className="py-2.5 px-2 text-right">YRLY Dep ($)</th>
                        <th className="py-2.5 px-2 text-right text-gray-400">Per Month</th>
                        <th className="py-2.5 px-2 text-right">YRLY New B</th>
                        <th className="py-2.5 px-2 text-right text-gray-400">Per Month</th>
                        <th className="py-2.5 px-3 text-right font-black text-gray-900 dark:text-white">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-mono">
                      {gridModel.budgetTable.rows.map(r => (
                        <tr key={r.siteCode} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="py-2 px-3 font-sans font-bold text-gray-900 dark:text-white">{r.location}</td>
                          <td className="py-2 px-2 text-right">{formatAUD(r.yearlyDepletion)}</td>
                          <td className="py-2 px-2 text-right text-gray-400">{formatAUD(r.perMonthDepletion)}</td>
                          <td className="py-2 px-2 text-right">{formatAUD(r.yearlyNewBusiness)}</td>
                          <td className="py-2 px-2 text-right text-gray-400">{formatAUD(r.perMonthNewBusiness)}</td>
                          <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">{formatAUD(r.total)}</td>
                        </tr>
                      ))}
                      {/* Total Sites */}
                      <tr className="bg-indigo-50/40 dark:bg-indigo-950/20 font-black text-indigo-950 dark:text-indigo-200 border-t border-indigo-200">
                        <td className="py-2.5 px-3 font-sans">Total</td>
                        <td className="py-2.5 px-2 text-right">{formatAUD(gridModel.budgetTable.totalRow.yearlyDepletion)}</td>
                        <td className="py-2.5 px-2 text-right text-indigo-800/60 dark:text-indigo-400">{formatAUD(gridModel.budgetTable.totalRow.perMonthDepletion)}</td>
                        <td className="py-2.5 px-2 text-right">{formatAUD(gridModel.budgetTable.totalRow.yearlyNewBusiness)}</td>
                        <td className="py-2.5 px-2 text-right text-indigo-800/60 dark:text-indigo-400">{formatAUD(gridModel.budgetTable.totalRow.perMonthNewBusiness)}</td>
                        <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400">{formatAUD(gridModel.budgetTable.totalRow.total)}</td>
                      </tr>
                      {/* Linen Hub */}
                      <tr className="bg-amber-500/5 font-black text-amber-900 dark:text-amber-300">
                        <td className="py-2.5 px-3 font-sans">LINEN HUB</td>
                        <td className="py-2.5 px-2 text-right">{formatAUD(gridModel.budgetTable.linenHubBudget)}</td>
                        <td className="py-2.5 px-2 text-right text-amber-800/60 dark:text-amber-400">{formatAUD(gridModel.budgetTable.linenHubBudget / 12)}</td>
                        <td className="py-2.5 px-2 text-right text-gray-400">-</td>
                        <td className="py-2.5 px-2 text-right text-gray-400">-</td>
                        <td className="py-2.5 px-3 text-right">{formatAUD(gridModel.budgetTable.linenHubBudget)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* YTD & CURRENT MONTH ACTUALS TABLE */}
              <div className="bg-white dark:bg-[#1c1f2b] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                    Actuals (Excl. GST) - YTD vs {gridModel.months[selectedMonthIndex - 1]?.label}
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-600">Net Parity</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/80 font-black text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                        <th className="py-2.5 px-3">Location</th>
                        <th className="py-2.5 px-3 text-right">Depletion (YTD)</th>
                        <th className="py-2.5 px-3 text-right">New B (YTD)</th>
                        <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black">Dep ({gridModel.months[selectedMonthIndex - 1]?.label})</th>
                        <th className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400 font-black">New B ({gridModel.months[selectedMonthIndex - 1]?.label})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-mono">
                      {gridModel.ytdTable.map(r => (
                        <tr key={r.siteCode} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="py-2 px-3 font-sans font-bold text-gray-900 dark:text-white">{r.location}</td>
                          <td className="py-2 px-3 text-right">{formatAUD(r.depletionYtd)}</td>
                          <td className="py-2 px-3 text-right">{formatAUD(r.newBusinessYtd)}</td>
                          <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">{formatAUD(r.depletionSelectedMonth)}</td>
                          <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400 font-bold">{formatAUD(r.newBusinessSelectedMonth)}</td>
                        </tr>
                      ))}
                      {/* Total */}
                      <tr className="bg-gray-100 dark:bg-gray-900/90 font-black text-gray-900 dark:text-white border-t border-gray-300">
                        <td className="py-2.5 px-3 font-sans uppercase">TOTAL</td>
                        <td className="py-2.5 px-3 text-right">{formatAUD(gridModel.ytdTotalRow.depletionYtd)}</td>
                        <td className="py-2.5 px-3 text-right">{formatAUD(gridModel.ytdTotalRow.newBusinessYtd)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">{formatAUD(gridModel.ytdTotalRow.depletionSelectedMonth)}</td>
                        <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">{formatAUD(gridModel.ytdTotalRow.newBusinessSelectedMonth)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* GOVERNANCE CARDS & CONTRACT STATUS METRICS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">LINEN HUB TILL DATE</div>
                  <div className="text-lg font-black text-amber-900 dark:text-amber-200 mt-0.5">{formatAUD(gridModel.kpiCards.linenHubTillDate)}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">LINEN HUB REMAINING</div>
                  <div className="text-lg font-black text-amber-900 dark:text-amber-200 mt-0.5">{formatAUD(gridModel.kpiCards.linenHubRemaining)}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <div className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300">DEP STATUS TILL DATE</div>
                  <div className="text-lg font-black text-blue-900 dark:text-blue-200 mt-0.5">{formatAUD(gridModel.kpiCards.depStatusTillDate)}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <div className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300">NB STATUS TILL DATE</div>
                  <div className="text-lg font-black text-blue-900 dark:text-blue-200 mt-0.5">{formatAUD(gridModel.kpiCards.nbStatusTillDate)}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">OVERALL DEP vs BUDGET</div>
                  <div className="text-lg font-black text-emerald-900 dark:text-emerald-200 mt-0.5">{formatAUD(gridModel.kpiCards.overallDepVsBudget)}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                  <div className="text-[10px] font-black uppercase text-purple-800 dark:text-purple-300">OVERALL NB vs BUDGET</div>
                  <div className="text-lg font-black text-purple-900 dark:text-purple-200 mt-0.5">{formatAUD(gridModel.kpiCards.overallNbVsBudget)}</div>
                </div>
              </div>

              {/* STRATEGIC CONTRACT ACCUMULATIONS */}
              <div className="p-4 rounded-3xl bg-white dark:bg-[#1c1f2b] border border-gray-200 dark:border-gray-800 space-y-2.5 text-xs">
                <div className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 pb-1 border-b border-gray-100 dark:border-gray-800">
                  Strategic Contract Tracking
                </div>
                <div className="flex justify-between font-mono">
                  <span className="font-sans text-gray-600 dark:text-gray-300">HSV (YTD)</span>
                  <span className="font-bold text-gray-900 dark:text-white">{formatAUD(gridModel.kpiCards.hsvYtd)}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="font-sans text-gray-600 dark:text-gray-300">RHC (YTD) - DEP</span>
                  <span className="font-bold text-gray-900 dark:text-white">{formatAUD(gridModel.kpiCards.rhcDepYtd)}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="font-sans text-gray-600 dark:text-gray-300">RHC (YTD) - NB</span>
                  <span className="font-bold text-gray-900 dark:text-white">{formatAUD(gridModel.kpiCards.rhcNbYtd)}</span>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between font-mono text-[11px] text-gray-500">
                  <span className="font-sans">HSV ({gridModel.months[selectedMonthIndex - 1]?.shortMonth}) - Included in DEP</span>
                  <span className="font-bold">{formatAUD(gridModel.kpiCards.hsvCurrentMonth)}</span>
                </div>
                <div className="flex justify-between font-mono text-[11px] text-gray-500">
                  <span className="font-sans">RHC ({gridModel.months[selectedMonthIndex - 1]?.shortMonth}) - Included in DEP</span>
                  <span className="font-bold">{formatAUD(gridModel.kpiCards.rhcDepCurrentMonth)}</span>
                </div>
                <div className="flex justify-between font-mono text-[11px] text-gray-500">
                  <span className="font-sans">RHC ({gridModel.months[selectedMonthIndex - 1]?.shortMonth}) - Included in NB</span>
                  <span className="font-bold">{formatAUD(gridModel.kpiCards.rhcNbCurrentMonth)}</span>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: 12-MONTH MONTHLY PERFORMANCE GRIDS (8 cols) ─── */}
            <div className="xl:col-span-8 space-y-6">
              {/* DEPLETION GRID */}
              <div className="bg-white dark:bg-[#1c1f2b] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950 dark:text-emerald-300">
                      DEPLETION (ACC + HC, Excl. GST)
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Monthly actuals vs. budget with dynamic green (within budget) and red (over budget) conditional formatting.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-[#99FF66] border border-black/10"></span>
                      <span>Within Budget</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-[#FFFF99] border border-black/10"></span>
                      <span>Over Budget</span>
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/80 font-black text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800">
                        <th className="py-2.5 px-3 min-w-[120px]">Location</th>
                        {gridModel.months.map(m => (
                          <th key={m.monthIndex} className="py-2.5 px-2 text-right min-w-[78px]">
                            {m.label}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right font-black min-w-[95px]">BALANCE YTG</th>
                        <th className="py-2.5 px-3 text-right font-black min-w-[85px]">SPEND YTD %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-mono">
                      {gridModel.depletionRows.map(row => (
                        <React.Fragment key={row.siteCode}>
                          {/* Actual Row */}
                          <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <td className="py-2 px-3 font-sans font-black text-gray-900 dark:text-white">
                              {row.siteName}
                            </td>
                            {row.monthlyActuals.map((val, idx) => {
                              const budget = row.monthlyBudgets[idx];
                              const isRecorded = val !== null && val !== undefined;
                              const isOverBudget = isRecorded && budget > 0 && val > budget;
                              const isUnderBudget = isRecorded && budget > 0 && val <= budget;
                              const cellKey = `${row.siteCode}:${idx + 1}:DEPLETION`;

                              let cellBg = '';
                              let cellText = 'text-gray-900 dark:text-white';
                              if (isOverBudget) {
                                cellBg = 'bg-[#FFFF99] text-gray-900 font-bold';
                              } else if (isUnderBudget) {
                                cellBg = 'bg-[#99FF66] text-gray-900 font-bold';
                              }

                              return (
                                <td key={idx} className={`py-2 px-2 text-right transition-colors ${cellBg}`}>
                                  {isEditActualsMode ? (
                                    <input
                                      type="number"
                                      value={editableOverrides[cellKey] !== undefined ? editableOverrides[cellKey] : (val || 0)}
                                      onChange={(e) => {
                                        const num = parseFloat(e.target.value) || 0;
                                        setEditableOverrides(prev => ({ ...prev, [cellKey]: num }));
                                      }}
                                      className="w-20 px-1 py-0.5 text-right text-[10px] font-mono font-bold rounded border border-emerald-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                                    />
                                  ) : (
                                    <span className={cellText}>{formatAUD(val)}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white bg-gray-50/40 dark:bg-gray-900/40">
                              {formatAUD(row.balanceYtg)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400 bg-gray-50/40 dark:bg-gray-900/40">
                              {row.spendYtdPercent}%
                            </td>
                          </tr>

                          {/* Budget Row */}
                          <tr className="bg-gray-50/30 dark:bg-gray-900/20 text-gray-500 dark:text-gray-400 text-[10px]">
                            <td className="py-1 px-3 font-sans italic text-gray-400">
                              MNTH $BUDGET
                            </td>
                            {row.monthlyBudgets.map((b, idx) => {
                              const budgetKey = `${row.siteCode}:${idx + 1}`;
                              const curVal = editableBudgets[budgetKey] !== undefined ? editableBudgets[budgetKey] : Math.round(b);

                              return (
                                <td key={idx} className="py-1 px-1 text-right">
                                  {isEditActualsMode ? (
                                    <input
                                      type="number"
                                      value={curVal}
                                      onChange={(e) => {
                                        const num = parseFloat(e.target.value) || 0;
                                        handleBudgetCellChange(row.siteCode, idx + 1, num);
                                      }}
                                      className="w-18 px-1 py-0.5 text-right text-[10px] font-mono font-bold rounded border border-indigo-400 bg-white dark:bg-gray-800 text-indigo-900 dark:text-indigo-200 outline-none"
                                      title={`Edit monthly budget for ${row.siteName} (${gridModel.months[idx]?.label})`}
                                    />
                                  ) : (
                                    formatAUD(b)
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-1 px-3 text-right text-gray-300">-</td>
                            <td className="py-1 px-3 text-right text-gray-300">-</td>
                          </tr>
                        </React.Fragment>
                      ))}

                      {/* Total Depletion Actuals Row */}
                      <tr className="bg-gray-100 dark:bg-gray-900/90 font-black text-gray-900 dark:text-white border-t-2 border-gray-300 dark:border-gray-700">
                        <td className="py-3 px-3 font-sans uppercase">TOTAL ACTUALS</td>
                        {gridModel.depletionTotalRow.monthlyActuals.map((val, idx) => (
                          <td key={idx} className="py-3 px-2 text-right">
                            {formatAUD(val)}
                          </td>
                        ))}
                        <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">
                          {formatAUD(gridModel.depletionTotalRow.balanceYtg)}
                        </td>
                        <td className="py-3 px-3 text-right text-indigo-600 dark:text-indigo-400">
                          {gridModel.depletionTotalRow.spendYtdPercent}%
                        </td>
                      </tr>

                      {/* Total Depletion Budget Row with Strict Balancing Check against Baseline */}
                      <tr className="bg-gray-50 dark:bg-gray-900/60 font-bold text-gray-700 dark:text-gray-300 text-[10px] border-t border-gray-200 dark:border-gray-800">
                        <td className="py-2.5 px-3 font-sans uppercase">
                          <div className="font-bold">MNTH BUDGET</div>
                          <div className="text-[9px] text-gray-400 font-normal">($826,750/mo)</div>
                        </td>
                        {gridModel.months.map((m, idx) => {
                          const baselineMonthlyTarget = Math.round(TOTAL_DEPLETION_BUDGET / 12); // $826,750
                          const trackingSiteCodes = ['MEL_ALB', 'SYD', 'ADL', 'BNE', 'CNS', 'MKY', 'PER'];
                          const currentMonthSum = trackingSiteCodes.reduce((sum, sCode) => {
                            const val = editableBudgets[`${sCode}:${m.monthIndex}`];
                            if (val !== undefined) return sum + val;
                            const r = gridModel.depletionRows.find(row => row.siteCode === sCode);
                            return sum + (r ? r.monthlyBudgets[idx] : 0);
                          }, 0);

                          const diff = Math.round(currentMonthSum - baselineMonthlyTarget);
                          const isBalanced = Math.abs(diff) < 2;

                          return (
                            <td key={m.monthIndex} className="py-2.5 px-2 text-right">
                              <div className="font-mono font-bold">{formatAUD(currentMonthSum)}</div>
                              {isEditActualsMode && (
                                <div className="mt-1 flex flex-col items-end gap-0.5">
                                  {isBalanced ? (
                                    <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/50 px-1 py-0.2 rounded border border-emerald-300/40">
                                      ✓ Balanced
                                    </span>
                                  ) : (
                                    <>
                                      <span className={`text-[8px] font-black px-1 py-0.2 rounded border ${
                                        diff > 0
                                          ? 'text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 border-amber-300/40'
                                          : 'text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/50 border-rose-300/40'
                                      }`}>
                                        {diff > 0 ? `+${formatAUD(diff)}` : formatAUD(diff)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleAutoBalanceMonth(m.monthIndex, diff)}
                                        className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                        title="Auto-balance difference to Melbourne to equal $826,750"
                                      >
                                        Auto-bal
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right font-black text-gray-900 dark:text-white">
                          {formatAUD(TOTAL_DEPLETION_BUDGET)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-400">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* NEW BUSINESS GRID */}
              <div className="bg-white dark:bg-[#1c1f2b] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-950 dark:text-amber-300">
                      NEW BUSINESS (ACC + HC, Excl. GST)
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Site-by-site tracking of growth contract purchases against New Business budget targets.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/80 font-black text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800">
                        <th className="py-2.5 px-3 min-w-[120px]">Location</th>
                        {gridModel.months.map(m => (
                          <th key={m.monthIndex} className="py-2.5 px-2 text-right min-w-[78px]">
                            {m.label}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right font-black min-w-[95px]">BALANCE YTG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-mono">
                      {gridModel.newBusinessRows.map(row => (
                        <React.Fragment key={row.siteCode}>
                          {/* Actual Row */}
                          <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <td className="py-2 px-3 font-sans font-black text-gray-900 dark:text-white">
                              {row.siteName}
                            </td>
                            {row.monthlyActuals.map((val, idx) => {
                              const budget = row.monthlyBudgets[idx];
                              const isRecorded = val !== null && val !== undefined && val > 0;
                              const isOverBudget = isRecorded && (budget === 0 || val > budget);
                              const isUnderBudget = isRecorded && budget > 0 && val <= budget;
                              const cellKey = `${row.siteCode}:${idx + 1}:NEW_BUSINESS`;

                              let cellBg = '';
                              let cellText = 'text-gray-900 dark:text-white';
                              if (isOverBudget) {
                                cellBg = 'bg-[#FFFF99] text-gray-900 font-bold';
                              } else if (isUnderBudget) {
                                cellBg = 'bg-[#99FF66] text-gray-900 font-bold';
                              }

                              return (
                                <td key={idx} className={`py-2 px-2 text-right transition-colors ${cellBg}`}>
                                  {isEditActualsMode ? (
                                    <input
                                      type="number"
                                      value={editableOverrides[cellKey] !== undefined ? editableOverrides[cellKey] : (val || 0)}
                                      onChange={(e) => {
                                        const num = parseFloat(e.target.value) || 0;
                                        setEditableOverrides(prev => ({ ...prev, [cellKey]: num }));
                                      }}
                                      className="w-20 px-1 py-0.5 text-right text-[10px] font-mono font-bold rounded border border-amber-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                                    />
                                  ) : (
                                    <span className={cellText}>{val !== null && val > 0 ? formatAUD(val) : (val === 0 ? '$0' : '-')}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white bg-gray-50/40 dark:bg-gray-900/40">
                              {formatAUD(row.balanceYtg)}
                            </td>
                          </tr>

                          {/* Budget Row */}
                          <tr className="bg-gray-50/30 dark:bg-gray-900/20 text-gray-500 dark:text-gray-400 text-[10px]">
                            <td className="py-1 px-3 font-sans italic text-gray-400">
                              MNTH $BUDGET
                            </td>
                            {row.monthlyBudgets.map((b, idx) => (
                              <td key={idx} className="py-1 px-2 text-right">
                                {formatAUD(b)}
                              </td>
                            ))}
                            <td className="py-1 px-3 text-right text-gray-300">-</td>
                          </tr>
                        </React.Fragment>
                      ))}

                      {/* Total New Business Row */}
                      <tr className="bg-gray-100 dark:bg-gray-900/90 font-black text-gray-900 dark:text-white border-t-2 border-gray-300 dark:border-gray-700">
                        <td className="py-3 px-3 font-sans uppercase">TOTAL</td>
                        {gridModel.newBusinessTotalRow.monthlyActuals.map((val, idx) => (
                          <td key={idx} className="py-3 px-2 text-right">
                            {formatAUD(val)}
                          </td>
                        ))}
                        <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400">
                          {formatAUD(gridModel.newBusinessTotalRow.balanceYtg)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: PURCHASE REQUEST EOM (PIVOT BREAKDOWN)                        */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === 'PIVOT_BREAKDOWN' && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-4 bg-white dark:bg-[#1c1f2b] rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-gray-900 dark:text-white">
                Purchase Request EOM - {pivotModel.monthLabel}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Four-panel pivot matrix replicating Purchase Request EOM SEP-26.xls Pivot Tab.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search PR, PO, Business..."
                  value={pivotSearch}
                  onChange={(e) => setPivotSearch(e.target.value)}
                  className="pl-8 pr-4 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* PANEL 1: LEFT DETAILED PR LIST (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-[#1c1f2b] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Purchase Requests by Sector (Excl. GST)
                </span>
                <span className="text-xs font-mono font-bold text-gray-500">
                  {filteredPivotPrs.length} record(s)
                </span>
              </div>

              <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
                    <tr className="font-black text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 text-[11px] uppercase">
                      <th className="py-2.5 px-3">PR #</th>
                      <th className="py-2.5 px-3">PO Number</th>
                      <th className="py-2.5 px-2">Business</th>
                      <th className="py-2.5 px-2">Reason</th>
                      <th className="py-2.5 px-3 text-right">Accommodation</th>
                      <th className="py-2.5 px-3 text-right">Healthcare</th>
                      <th className="py-2.5 px-3 text-right font-black text-gray-900 dark:text-white">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-mono text-[11px]">
                    {filteredPivotPrs.map((pr, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="py-2 px-3 font-sans font-bold text-emerald-600 dark:text-emerald-400">
                          {pr.prNumber}
                        </td>
                        <td className="py-2 px-3 font-bold text-gray-900 dark:text-white">
                          {pr.poNumber}
                        </td>
                        <td className="py-2 px-2 font-sans font-semibold">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                            pr.business === 'HSV' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                            pr.business === 'RHC' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                            pr.business === 'Linen Hub' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {pr.business}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-sans text-gray-500">
                          {pr.reason}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {pr.accommodation > 0 ? formatAUDExact(pr.accommodation) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {pr.healthcare > 0 ? formatAUDExact(pr.healthcare) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">
                          {formatAUDExact(pr.grandTotal)}
                        </td>
                      </tr>
                    ))}
                    {filteredPivotPrs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400 font-sans text-xs">
                          No purchase requests match the selected month and query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-gray-100 dark:bg-gray-900 font-black border-t-2 border-gray-300 dark:border-gray-700">
                    <tr className="text-xs text-gray-900 dark:text-white font-mono">
                      <td colSpan={4} className="py-3 px-3 font-sans uppercase">Grand Total</td>
                      <td className="py-3 px-3 text-right">{formatAUDExact(pivotModel.prsTotal.accommodation)}</td>
                      <td className="py-3 px-3 text-right">{formatAUDExact(pivotModel.prsTotal.healthcare)}</td>
                      <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatAUDExact(pivotModel.prsTotal.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* RIGHT SIDE PANELS (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* PANEL 2: DEPLETION SUMMARY */}
              <div className="bg-white dark:bg-[#1c1f2b] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="p-3.5 border-b border-gray-200 dark:border-gray-800 bg-emerald-500/10 flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950 dark:text-emerald-300">
                    DEPLETION (HSV INCLUDED)
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Branch Breakdown</span>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/80 font-black text-gray-500 text-[10px] uppercase border-b border-gray-200 dark:border-gray-800">
                      <th className="py-2 px-3">Branch</th>
                      <th className="py-2 px-3 text-right">Accommodation</th>
                      <th className="py-2 px-3 text-right">Healthcare</th>
                      <th className="py-2 px-3 text-right font-black">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-mono text-[11px]">
                    {pivotModel.depletionSummary.map(r => (
                      <tr key={r.branch} className="hover:bg-gray-50/50">
                        <td className="py-2 px-3 font-sans font-bold text-gray-900 dark:text-white">{r.branch}</td>
                        <td className="py-2 px-3 text-right">{r.accommodation > 0 ? formatAUDExact(r.accommodation) : '-'}</td>
                        <td className="py-2 px-3 text-right">{r.healthcare > 0 ? formatAUDExact(r.healthcare) : '-'}</td>
                        <td className="py-2 px-3 text-right font-bold">{formatAUDExact(r.grandTotal)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50/60 dark:bg-emerald-950/40 font-black text-emerald-950 dark:text-emerald-200 border-t border-emerald-200">
                      <td className="py-2.5 px-3 font-sans uppercase">Grand Total</td>
                      <td className="py-2.5 px-3 text-right">{formatAUDExact(pivotModel.depletionTotal.accommodation)}</td>
                      <td className="py-2.5 px-3 text-right">{formatAUDExact(pivotModel.depletionTotal.healthcare)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">{formatAUDExact(pivotModel.depletionTotal.grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* PANEL 3: NEW BUSINESS SUMMARY */}
              <div className="bg-white dark:bg-[#1c1f2b] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="p-3.5 border-b border-gray-200 dark:border-gray-800 bg-amber-500/10 flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-950 dark:text-amber-300">
                    NEW BUSINESS
                  </h4>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Branch Breakdown</span>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/80 font-black text-gray-500 text-[10px] uppercase border-b border-gray-200 dark:border-gray-800">
                      <th className="py-2 px-3">Branch</th>
                      <th className="py-2 px-3 text-right">Accommodation</th>
                      <th className="py-2 px-3 text-right">Healthcare</th>
                      <th className="py-2 px-3 text-right font-black">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-mono text-[11px]">
                    {pivotModel.newBusinessSummary.map(r => (
                      <tr key={r.branch} className="hover:bg-gray-50/50">
                        <td className="py-2 px-3 font-sans font-bold text-gray-900 dark:text-white">{r.branch}</td>
                        <td className="py-2 px-3 text-right">{r.accommodation > 0 ? formatAUDExact(r.accommodation) : '-'}</td>
                        <td className="py-2 px-3 text-right">{r.healthcare > 0 ? formatAUDExact(r.healthcare) : '-'}</td>
                        <td className="py-2 px-3 text-right font-bold">{formatAUDExact(r.grandTotal)}</td>
                      </tr>
                    ))}
                    <tr className="bg-amber-50/60 dark:bg-amber-950/40 font-black text-amber-950 dark:text-amber-200 border-t border-amber-200">
                      <td className="py-2.5 px-3 font-sans uppercase">Grand Total</td>
                      <td className="py-2.5 px-3 text-right">{formatAUDExact(pivotModel.newBusinessTotal.accommodation)}</td>
                      <td className="py-2.5 px-3 text-right">{formatAUDExact(pivotModel.newBusinessTotal.healthcare)}</td>
                      <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">{formatAUDExact(pivotModel.newBusinessTotal.grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* PANEL 4: CROSS-TAB MATRIX */}
              <div className="bg-white dark:bg-[#1c1f2b] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="p-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                    Cross-Tab Breakdown by Stream &amp; Sector
                  </h4>
                </div>
                <div className="overflow-x-auto max-h-[350px]">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 border-b border-gray-200">
                        <th className="py-2 px-2.5">Branch</th>
                        <th className="py-2 px-2">Reason</th>
                        <th className="py-2 px-2 text-right">BAU Acc</th>
                        <th className="py-2 px-2 text-right">BAU HC</th>
                        <th className="py-2 px-2 text-right text-amber-600">Linen Hub</th>
                        <th className="py-2 px-2 text-right text-purple-600">HSV</th>
                        <th className="py-2 px-2 text-right">NB Acc</th>
                        <th className="py-2 px-2 text-right">NB HC</th>
                        <th className="py-2 px-2.5 text-right font-black">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-mono text-[10px]">
                      {pivotModel.crossTabMatrix.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="py-1.5 px-2.5 font-sans font-bold text-gray-900 dark:text-white">{r.branch}</td>
                          <td className="py-1.5 px-2 font-sans text-gray-500">{r.reason}</td>
                          <td className="py-1.5 px-2 text-right">{r.bauAccommodation > 0 ? formatAUD(r.bauAccommodation) : '-'}</td>
                          <td className="py-1.5 px-2 text-right">{r.bauHealthcare > 0 ? formatAUD(r.bauHealthcare) : '-'}</td>
                          <td className="py-1.5 px-2 text-right text-amber-600 font-semibold">{r.linenHub > 0 ? formatAUD(r.linenHub) : '-'}</td>
                          <td className="py-1.5 px-2 text-right text-purple-600 font-semibold">{r.hsv > 0 ? formatAUD(r.hsv) : '-'}</td>
                          <td className="py-1.5 px-2 text-right">{r.newBusinessAccommodation > 0 ? formatAUD(r.newBusinessAccommodation) : '-'}</td>
                          <td className="py-1.5 px-2 text-right">{r.newBusinessHealthcare > 0 ? formatAUD(r.newBusinessHealthcare) : '-'}</td>
                          <td className="py-1.5 px-2.5 text-right font-bold">{formatAUD(r.grandTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 dark:bg-gray-900 font-black border-t border-gray-300 font-mono text-[10px]">
                      <tr>
                        <td colSpan={2} className="py-2 px-2.5 font-sans uppercase">Grand Total</td>
                        <td className="py-2 px-2 text-right">{formatAUD(pivotModel.crossTabTotal.bauAccommodation)}</td>
                        <td className="py-2 px-2 text-right">{formatAUD(pivotModel.crossTabTotal.bauHealthcare)}</td>
                        <td className="py-2 px-2 text-right text-amber-600">{formatAUD(pivotModel.crossTabTotal.linenHub)}</td>
                        <td className="py-2 px-2 text-right text-purple-600">{formatAUD(pivotModel.crossTabTotal.hsv)}</td>
                        <td className="py-2 px-2 text-right">{formatAUD(pivotModel.crossTabTotal.newBusinessAccommodation)}</td>
                        <td className="py-2 px-2 text-right">{formatAUD(pivotModel.crossTabTotal.newBusinessHealthcare)}</td>
                        <td className="py-2 px-2.5 text-right text-emerald-600 text-xs">{formatAUD(pivotModel.crossTabTotal.grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: CONCUR RAW DATA AUDIT & RECONCILIATION                        */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === 'CONCUR_RECONCILIATION' && (() => {
        const activeEmailItem = concurEmailAttachments.find(a => a.id === selectedEmailAttachmentId) || concurEmailAttachments[0];

        return (
          <div className="space-y-6 animate-fade-in">
            {/* Header Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/20">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="text-indigo-600" size={20} />
                    <span>Concur Raw Data Audit &amp; Parity Check</span>
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 max-w-3xl">
                    Automated intake pipeline detects month-end Concur reports directly from the finance inbox queue. The reconciliation engine matches every Purchase Order against ProcureFlow and audits Ex-GST amounts for 100% General Ledger parity.
                  </p>
                </div>

                {parsedConcurRows.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-500/20 flex items-center gap-1.5 shadow-sm">
                      <CheckCircle2 size={14} />
                      {reconciliationResults.parityPercent}% Match Rate
                    </span>
                    <button
                      type="button"
                      onClick={handleExportReconciliationExcel}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all"
                      title="Export complete reconciliation audit to Excel"
                    >
                      <Download size={14} />
                      <span>Export Audit</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── AUTOMATED EMAIL INTAKE PIPELINE CARD ──────────────────────────── */}
            <div className="bg-white dark:bg-[#1c1f2b] p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center relative">
                    <Mail size={24} />
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white">
                        Automated Finance Email Intake Pipeline
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/20">
                        Live Inbox Queue
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {concurEmailAttachments.length > 0
                        ? `Detected ${concurEmailAttachments.length} Concur month-end spreadsheet(s) in the finance email queue.`
                        : 'Monitoring finance intake mailbox for incoming Concur month-end spreadsheets...'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => refreshEmailIngestionQueue()}
                    disabled={isSyncingEmail}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                    title="Check inbox for new incoming emails"
                  >
                    <RefreshCw size={13} className={isSyncingEmail ? 'animate-spin' : ''} />
                    <span>Refresh Inbox</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncSelectedEmail()}
                    disabled={isSyncingEmail || !activeEmailItem}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSyncingEmail ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                    <span>{parsedConcurRows.length > 0 ? 'Re-Sync Concur Data' : 'Sync & Reconcile'}</span>
                  </button>
                </div>
              </div>

              {/* Concur Inbound Mailbox Configuration Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/70 dark:border-indigo-900/30 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-gray-700 dark:text-gray-300 shrink-0">Monitored Mailbox:</span>
                  {isEditingInboxEmail ? (
                    <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                      <input
                        type="email"
                        value={tempInboxEmail}
                        onChange={(e) => setTempInboxEmail(e.target.value)}
                        placeholder="e.g. concur-reports@splservices.com.au"
                        className="px-2.5 py-1 text-xs rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none w-full"
                      />
                      <button
                        type="button"
                        onClick={handleSaveConcurInboxEmail}
                        disabled={isSavingInboxEmail || !tempInboxEmail.trim()}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold disabled:opacity-50 shrink-0 cursor-pointer"
                      >
                        {isSavingInboxEmail ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingInboxEmail(false)}
                        className="px-2 py-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-bold text-indigo-900 dark:text-indigo-200 truncate">{concurInboxEmail}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setTempInboxEmail(concurInboxEmail);
                          setIsEditingInboxEmail(true);
                        }}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer"
                      >
                        Edit Mailbox
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
                  Automated background daemon checks this inbox for Concur month-end reports
                </span>
              </div>

              {/* Active Detected Report Details */}
              {activeEmailItem ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase text-gray-400">
                        Active Email Attachment
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                        {activeEmailItem.metadata.monthLabel} • {activeEmailItem.metadata.reportDateLabel ? `${activeEmailItem.metadata.reportDateLabel} snapshot` : activeEmailItem.metadata.versionTag}
                      </span>
                    </div>

                    {concurEmailAttachments.length > 1 ? (
                      <select
                        value={selectedEmailAttachmentId || activeEmailItem.id}
                        onChange={(e) => {
                          setSelectedEmailAttachmentId(e.target.value);
                          handleSyncSelectedEmail(e.target.value);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white"
                      >
                        {concurEmailAttachments.map(att => (
                          <option key={att.id} value={att.id}>
                            {att.attachmentName} — {att.metadata.monthLabel} ({att.metadata.reportDateLabel ? `${att.metadata.reportDateLabel} snapshot` : att.metadata.versionTag}) {!att.isLatestForMonth ? '⚠️ (Superseded)' : '✓ (Latest)'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono font-bold text-indigo-950 dark:text-indigo-200 text-sm flex items-center gap-1.5 truncate">
                        <FileSpreadsheet size={15} className="text-indigo-600 flex-shrink-0" />
                        {activeEmailItem.attachmentName}
                      </span>
                    )}

                    {!activeEmailItem.isLatestForMonth && (
                      <div className="mt-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>Superseded by newer report: {activeEmailItem.supersededBy}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Sender &amp; Subject</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300 block truncate" title={activeEmailItem.fromAddress}>
                      From: {activeEmailItem.fromAddress || 'finance@splservices.com.au'}
                    </span>
                    <span className="text-[11px] text-gray-500 truncate block" title={activeEmailItem.subject}>
                      {activeEmailItem.subject || 'Concur Month End Report'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Received Timestamp</span>
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <Clock size={13} className="text-gray-400" />
                      {activeEmailItem.receivedAt ? new Date(activeEmailItem.receivedAt).toLocaleString('en-AU') : 'Recently received'}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block">
                      ✓ Ready for {activeEmailItem.metadata.monthLabel} reconciliation
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-dashed border-gray-200 dark:border-gray-700 text-center py-6">
                  <Inbox size={28} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    No Concur month-end spreadsheets detected in the inbox queue yet.
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    When reports like `Purchase Request EOM SEP-26.xls` are emailed to <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{concurInboxEmail}</span>, they will be automatically ingested here.
                  </p>
                </div>
              )}
            </div>

            {/* ── RECONCILIATION SUMMARY DASHBOARD ─────────────────────────────── */}
            {parsedConcurRows.length > 0 && (
              <div className="space-y-6">
                {/* 4 Executive KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#1c1f2b] border border-gray-200 dark:border-gray-800 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-gray-400">Total Concur ({reconciliationResults.targetMonthLabel}, Ex-GST)</span>
                    <div className="text-xl font-black text-gray-900 dark:text-white mt-1">
                      {formatAUDExact(reconciliationResults.concurTotalEx)}
                    </div>
                    <span className="text-[11px] text-gray-500 mt-1 block font-mono">{parsedConcurRows.length} Concur records</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-[#1c1f2b] border border-gray-200 dark:border-gray-800 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-gray-400">ProcureFlow ({reconciliationResults.targetMonthLabel}, Ex-GST)</span>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatAUDExact(reconciliationResults.pfTotalEx)}
                    </div>
                    <span className="text-[11px] text-emerald-600 mt-1 block font-mono">{reconciliationResults.matchCount} matched items</span>
                  </div>

                  <div className={`p-4 rounded-2xl border shadow-sm ${
                    Math.abs(reconciliationResults.netVariance) <= 0.05
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-rose-500/5 border-rose-500/20'
                  }`}>
                    <span className="text-[10px] font-black uppercase text-gray-400">Net Variance ({reconciliationResults.targetMonthLabel})</span>
                    <div className={`text-xl font-black mt-1 font-mono ${
                      Math.abs(reconciliationResults.netVariance) <= 0.05 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {formatAUDExact(reconciliationResults.netVariance)}
                    </div>
                    <span className="text-[11px] text-gray-500 mt-1 block">
                      {Math.abs(reconciliationResults.netVariance) <= 0.05 ? '✓ Full GL Parity Achieved' : 'Variance requires investigation'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-[#1c1f2b] border border-gray-200 dark:border-gray-800 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-gray-400">Discrepancy Breakdown</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="px-2 py-0.5 rounded text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" title="Amount differences">
                        {reconciliationResults.mismatchCount} Diff
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" title="In Concur but missing in ProcureFlow">
                        {reconciliationResults.missingInPfCount} Missing in PF
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" title="Approved in ProcureFlow but not in Concur">
                        {reconciliationResults.missingInConcurCount} Missing in Concur
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visual Variance Explanatory Banner */}
                {reconciliationResults.mismatchCount > 0 || reconciliationResults.missingInConcurCount > 0 || reconciliationResults.missingInPfCount > 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">Variance Analysis &amp; Reconciliation Notes ({reconciliationResults.targetMonthLabel}):</p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                        {reconciliationResults.mismatchCount > 0 && (
                          <li>
                            <strong>{reconciliationResults.mismatchCount} Purchase Order(s)</strong> have amount discrepancies between Concur and ProcureFlow (often attributable to freight, invoice rounding, or line-item adjustments).
                          </li>
                        )}
                        {reconciliationResults.missingInConcurCount > 0 && (
                          <li>
                            <strong>{reconciliationResults.missingInConcurCount} approved ProcureFlow PO(s)</strong> for {reconciliationResults.targetMonthLabel} have not yet been created in Concur.
                          </li>
                        )}
                        {reconciliationResults.missingInPfCount > 0 && (
                          <li>
                            <strong>{reconciliationResults.missingInPfCount} record(s) in Concur</strong> have no matching internal ProcureFlow PO number.
                          </li>
                        )}
                        {reconciliationResults.items.some(i => i.isClassicLinen) && (
                          <li className="text-indigo-800 dark:text-indigo-300 font-medium">
                            <strong>Classic Linen reconciliation:</strong> Concur transactions with SYD branch prefix and &lsquo;CL&rsquo; identifiers are recognized and reconciled against SPL Classic Linen in ProcureFlow.
                          </li>
                        )}
                        <li className="text-gray-700 dark:text-gray-300 font-medium">
                          <strong>Approved requests scope:</strong> Reconciliation audits approved requests only (Stage 2: PR # Logging and above). Unapproved requests in Draft or awaiting approval are excluded from missing checks.
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                    <span className="font-bold">
                      100% General Ledger Parity for {reconciliationResults.targetMonthLabel}! All Purchase Orders and net Ex-GST expenditure match between Concur and ProcureFlow.
                    </span>
                  </div>
                )}

                {/* ── RECONCILIATION DRILLDOWN TABLE ───────────────────────────── */}
                <div className="bg-white dark:bg-[#1c1f2b] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                        Side-by-Side Reconciliation Audit Log ({reconciliationResults.targetMonthLabel})
                      </h4>
                      <span className="text-xs font-mono font-bold text-gray-500">
                        ({filteredReconciliationItems.length} of {reconciliationResults.items.length})
                      </span>
                    </div>

                    {/* Search & Filter Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Search */}
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                          type="text"
                          value={concurSearchQuery}
                          onChange={(e) => setConcurSearchQuery(e.target.value)}
                          placeholder="Search PO, PR, branch..."
                          className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none w-44 focus:w-56 transition-all"
                        />
                      </div>

                      {/* Filter Pills */}
                      <div className="flex items-center gap-1 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setReconciliationFilter('ALL')}
                          className={`px-3 py-1 rounded-xl transition-all ${
                            reconciliationFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          All ({reconciliationResults.items.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReconciliationFilter('MISMATCH')}
                          className={`px-3 py-1 rounded-xl transition-all ${
                            reconciliationFilter === 'MISMATCH' ? 'bg-rose-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          Mismatches ({reconciliationResults.mismatchCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReconciliationFilter('MISSING_PF')}
                          className={`px-3 py-1 rounded-xl transition-all ${
                            reconciliationFilter === 'MISSING_PF' ? 'bg-amber-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          Missing in PF ({reconciliationResults.missingInPfCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReconciliationFilter('MISSING_CONCUR')}
                          className={`px-3 py-1 rounded-xl transition-all ${
                            reconciliationFilter === 'MISSING_CONCUR' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          Missing in Concur ({reconciliationResults.missingInConcurCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReconciliationFilter('MATCHED')}
                          className={`px-3 py-1 rounded-xl transition-all ${
                            reconciliationFilter === 'MATCHED' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          Matched ({reconciliationResults.matchCount})
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10 text-[11px] font-black uppercase text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">PF Stage</th>
                          <th className="py-2.5 px-3">PO Number</th>
                          <th className="py-2.5 px-3">PR #</th>
                          <th className="py-2.5 px-4 text-right">Concur (Ex-GST)</th>
                          <th className="py-2.5 px-4 text-right">ProcureFlow (Ex-GST)</th>
                          <th className="py-2.5 px-4 text-right">Variance (Δ)</th>
                          <th className="py-2.5 px-4">Entity / Branch</th>
                          <th className="py-2.5 px-4">Description &amp; Vendor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-mono text-[11px]">
                        {filteredReconciliationItems.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-gray-400 font-sans">
                              No records match the current filter.
                            </td>
                          </tr>
                        ) : (
                          filteredReconciliationItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                              <td className="py-2 px-3 font-sans">
                                {item.status === 'MATCHED' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    Matched
                                  </span>
                                )}
                                {item.status === 'AMOUNT_MISMATCH' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                    Mismatch
                                  </span>
                                )}
                                {item.status === 'MISSING_IN_PROCUREFLOW' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    Missing in PF
                                  </span>
                                )}
                                {item.status === 'MISSING_IN_CONCUR' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                    Missing in Concur
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-sans">
                                {item.procureFlowStage ? (
                                  <div 
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${item.procureFlowStage.bgLightClass} ${item.procureFlowStage.textClass} border ${item.procureFlowStage.borderClass} font-bold text-[10px] shadow-2xs whitespace-nowrap`}
                                    title={`${item.procureFlowStage.stageTitle}: ${item.procureFlowStage.descriptor}`}
                                  >
                                    <item.procureFlowStage.icon size={12} className="shrink-0" />
                                    <span>Stage {item.procureFlowStage.num} &bull; {item.procureFlowStage.shortLabel}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-600 text-[10px] font-mono pl-2" title="Not in ProcureFlow">-</span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-bold text-gray-900 dark:text-white">
                                {item.poNumber}
                              </td>
                              <td className="py-2 px-3 text-gray-500 font-sans">
                                {item.prNumber || '-'}
                              </td>
                              <td className="py-2 px-4 text-right">
                                {item.concurExGst > 0 ? formatAUDExact(item.concurExGst) : '-'}
                              </td>
                              <td className="py-2 px-4 text-right">
                                {item.procureFlowExGst > 0 ? formatAUDExact(item.procureFlowExGst) : '-'}
                              </td>
                              <td className={`py-2 px-4 text-right font-bold ${
                                item.variance === 0 ? 'text-gray-400' :
                                item.variance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'
                              }`}>
                                {item.variance === 0 ? (
                                  <span className="text-gray-400">$0.00</span>
                                ) : (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    item.variance > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                  }`}>
                                    {item.variance > 0 ? `+${formatAUDExact(item.variance)}` : formatAUDExact(item.variance)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-4 font-sans text-gray-600 dark:text-gray-300">
                                {item.isClassicLinen ? (
                                  <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/50">
                                    Classic Linen <span className="text-[10px] text-indigo-500 font-mono font-normal">(SYD)</span>
                                  </span>
                                ) : (
                                  item.branch || '-'
                                )}
                              </td>
                              <td className="py-2 px-4 font-sans text-gray-500 dark:text-gray-400 truncate max-w-[240px]" title={`${item.description || ''} (${item.vendor || ''})`}>
                                <span>{item.description || '-'}</span>
                                {item.vendor && (
                                  <span className="text-gray-400 text-[10px] block truncate">
                                    {item.vendor}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
