import { PORequest, LifecycleTriggersConfig, StageStatusResult, DEFAULT_LIFECYCLE_TRIGGERS } from '../types.ts';

export interface POTriggerEvaluation {
  stageNum: number;
  level: 'ALERT' | 'WARNING' | 'OK';
  reason: string;
}

/**
 * Evaluates a single purchase order against lifecycle trigger thresholds.
 */
export function evaluatePOTrigger(
  po: PORequest,
  config: LifecycleTriggersConfig = DEFAULT_LIFECYCLE_TRIGGERS
): POTriggerEvaluation {
  const now = Date.now();

  // Stage 1: PENDING_APPROVAL / DRAFT
  if (po.status === 'PENDING_APPROVAL' || po.status === 'DRAFT') {
    const createdTime = new Date(po.requestDate || po.createdAt || now).getTime();
    const hours = Math.max(0, (now - createdTime) / (1000 * 60 * 60));
    if (hours >= config.stage1AlertHours) {
      const days = Math.floor(hours / 24);
      return { 
        stageNum: 1, 
        level: 'ALERT', 
        reason: `Pending approval > ${days > 0 ? `${days}d ` : ''}(${Math.floor(hours)}h total)` 
      };
    }
    if (hours >= config.stage1WarningHours) {
      return { 
        stageNum: 1, 
        level: 'WARNING', 
        reason: `Pending approval > ${Math.floor(hours)}h` 
      };
    }
    return { stageNum: 1, level: 'OK', reason: '' };
  }

  // Stage 2: APPROVED_PENDING_CONCUR_REQUEST
  if (po.status === 'APPROVED_PENDING_CONCUR_REQUEST') {
    const refTime = new Date(po.updatedAt || po.requestDate || now).getTime();
    const days = Math.max(0, (now - refTime) / (1000 * 60 * 60 * 24));
    if (!po.concurRequestNumber) {
      if (days >= config.stage2AlertDays) {
        return { 
          stageNum: 2, 
          level: 'ALERT', 
          reason: `Missing Concur PR# > ${Math.floor(days)}d` 
        };
      }
      if (days >= config.stage2WarningDays) {
        return { 
          stageNum: 2, 
          level: 'WARNING', 
          reason: `Missing Concur PR# > ${Math.floor(days)}d` 
        };
      }
    }
    return { stageNum: 2, level: 'OK', reason: '' };
  }

  // Stage 3: APPROVED_PENDING_CONCUR
  if (po.status === 'APPROVED_PENDING_CONCUR') {
    const refTime = new Date(po.updatedAt || po.requestDate || now).getTime();
    const days = Math.max(0, (now - refTime) / (1000 * 60 * 60 * 24));
    if (!po.concurPoNumber) {
      if (days >= config.stage3AlertDays) {
        return { 
          stageNum: 3, 
          level: 'ALERT', 
          reason: `Awaiting Concur PO# > ${Math.floor(days)}d` 
        };
      }
      if (days >= config.stage3WarningDays) {
        return { 
          stageNum: 3, 
          level: 'WARNING', 
          reason: `Awaiting Concur PO# > ${Math.floor(days)}d` 
        };
      }
    }
    return { stageNum: 2, level: 'OK', reason: '' };
  }

  // Stage 4: ACTIVE (Order In Transit / Expected)
  if (po.status === 'ACTIVE') {
    let worstLevel: 'ALERT' | 'WARNING' | 'OK' = 'OK';
    let worstReason = '';

    for (const l of po.lines || []) {
      const isFulfilled = (l.quantityReceived || 0) >= l.quantityOrdered;
      if (isFulfilled || !l.needByDate) continue;

      const diffDays = (now - new Date(l.needByDate).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= config.stage4AlertOverdueDays) {
        return { 
          stageNum: 4, 
          level: 'ALERT', 
          reason: `Overdue > ${Math.floor(diffDays)}d past need-by date` 
        };
      }
      if (diffDays > 0) {
        worstLevel = 'WARNING';
        worstReason = `Overdue by ${Math.floor(diffDays)}d`;
      } else if (Math.abs(diffDays) <= config.stage4WarningDaysToNeedBy && worstLevel !== 'WARNING') {
        worstLevel = 'WARNING';
        worstReason = `Need-by date in ${Math.max(1, Math.ceil(Math.abs(diffDays)))}d`;
      }
    }
    return { stageNum: 4, level: worstLevel, reason: worstReason };
  }

  // Stage 5: RECEIVED / VARIANCE_PENDING (Goods On-Site / Verification)
  if (po.status === 'RECEIVED' || po.status === 'VARIANCE_PENDING') {
    const allReceived = po.lines && po.lines.length > 0 && po.lines.every(l => (l.quantityReceived || 0) >= l.quantityOrdered);
    const refTime = new Date(po.updatedAt || po.requestDate || now).getTime();
    const days = Math.max(0, (now - refTime) / (1000 * 60 * 60 * 24));

    if (allReceived) {
      if (days >= config.stage5AlertDays) {
        return { 
          stageNum: 5, 
          level: 'ALERT', 
          reason: `100% Received — unclosed for > ${Math.floor(days)}d` 
        };
      }
      return { 
        stageNum: 5, 
        level: 'WARNING', 
        reason: `100% Received — ready for final closure` 
      };
    }

    if (po.status === 'VARIANCE_PENDING') {
      return { 
        stageNum: 5, 
        level: 'WARNING', 
        reason: 'Delivery variance pending resolution' 
      };
    }

    if (days >= config.stage5WarningDays) {
      return { 
        stageNum: 5, 
        level: 'WARNING', 
        reason: `Partial delivery stagnant for ${Math.floor(days)}d` 
      };
    }

    return { stageNum: 5, level: 'OK', reason: '' };
  }

  // Stage 6: CLOSED (Complete & Reconciled)
  if (po.status === 'CLOSED') {
    if (po.hasDiscrepancy) {
      return { 
        stageNum: 6, 
        level: 'WARNING', 
        reason: 'Closed with noted discrepancy' 
      };
    }
    return { stageNum: 6, level: 'OK', reason: '' };
  }

  return { stageNum: 0, level: 'OK', reason: '' };
}

/**
 * Evaluates all lifecycle stages (1-6) across a collection of purchase orders.
 */
export function evaluateAllStagesStatus(
  pos: PORequest[],
  config: LifecycleTriggersConfig = DEFAULT_LIFECYCLE_TRIGGERS
): Record<number, StageStatusResult> {
  const result: Record<number, StageStatusResult> = {
    1: { stageNum: 1, alertCount: 0, warningCount: 0, status: 'NORMAL', alertItems: [], warningItems: [] },
    2: { stageNum: 2, alertCount: 0, warningCount: 0, status: 'NORMAL', alertItems: [], warningItems: [] },
    3: { stageNum: 3, alertCount: 0, warningCount: 0, status: 'NORMAL', alertItems: [], warningItems: [] },
    4: { stageNum: 4, alertCount: 0, warningCount: 0, status: 'NORMAL', alertItems: [], warningItems: [] },
    5: { stageNum: 5, alertCount: 0, warningCount: 0, status: 'NORMAL', alertItems: [], warningItems: [] },
    6: { stageNum: 6, alertCount: 0, warningCount: 0, status: 'NORMAL', alertItems: [], warningItems: [] },
  };

  pos.forEach(po => {
    const evaluation = evaluatePOTrigger(po, config);
    if (evaluation.stageNum >= 1 && evaluation.stageNum <= 6) {
      const stageObj = result[evaluation.stageNum];
      if (evaluation.level === 'ALERT') {
        stageObj.alertCount += 1;
        stageObj.alertItems.push(po.id);
      } else if (evaluation.level === 'WARNING') {
        stageObj.warningCount += 1;
        stageObj.warningItems.push(po.id);
      }
    }
  });

  for (let s = 1; s <= 6; s++) {
    if (result[s].alertCount > 0) {
      result[s].status = 'ALERT';
    } else if (result[s].warningCount > 0) {
      result[s].status = 'WARNING';
    } else {
      result[s].status = 'NORMAL';
    }
  }

  return result;
}
