export interface ItemContext {
  id: string; // master_item_id
  name: string;
  shortQty: number; // monthly short supply quantity
  starDays: number;
  depreciationMonths: number;
  shrinkagePercent: number;
  revenuePerCycle: number;
  purchasePrice: number;
  weightKg: number;
}

export interface AllocatedItem {
  id: string;
  name: string;
  adjustedShort: number;
  rawUnits: number;
  efficiency: number;
  allocatedQty: number;
  estimatedSpend: number;
  annualUplift: number;
}

export function calculateBuyingPlan(
  items: ItemContext[],
  budget: number,
  ssPercent: number
): AllocatedItem[] {
  // 1. Calculate Raw Requirements and Efficiency for each item
  const rawPlans = items.map((item) => {
    // Stage 1 - Raw Buy Requirement
    const adjustedShort = Math.max(0, item.shortQty * (ssPercent / 100));
    
    // Cycle Factor & Loss Factor
    const cycleFactor = item.starDays > 0 ? item.starDays / 30 : 0;
    const lossFactor =
      1 +
      (item.depreciationMonths > 0 ? 12 / item.depreciationMonths : 0) +
      item.shrinkagePercent / 100;

    const rawUnits = Math.ceil(adjustedShort * cycleFactor * lossFactor);

    // Stage 2 - Efficiency Ranking
    const annualCycles = item.starDays > 0 ? 365 / item.starDays : 0;
    const availabilityFactor =
      Math.min(1, item.depreciationMonths / 12) * (1 - item.shrinkagePercent / 100);

    const upliftPerUnit = item.revenuePerCycle * annualCycles * availabilityFactor;
    
    // Fallback logic if purchase price is 0 to avoid Infinity
    const efficiency = item.purchasePrice > 0 ? upliftPerUnit / item.purchasePrice : 0;

    return {
      ...item,
      adjustedShort,
      cycleFactor,
      lossFactor,
      rawUnits,
      efficiency,
    };
  });

  // 2. Sort items by Efficiency (Descending)
  const rankedPlans = [...rawPlans].sort((a, b) => b.efficiency -  a.efficiency);

  // 3. Sequential Budget Allocation
  let remainingBudget = budget;
  
  const allocatedItems: AllocatedItem[] = rankedPlans.map((plan) => {
    // Final units within remaining budget
    // Assuming sequence order matches sort order exactly (greedy knapsack)
    let allocatedQty = 0;
    if (remainingBudget > 0 && plan.purchasePrice > 0) {
        const affordableUnits = Math.floor(remainingBudget / plan.purchasePrice);
        allocatedQty = Math.min(plan.rawUnits, affordableUnits);
    }
    
    const estimatedSpend = allocatedQty * plan.purchasePrice;
    
    // Remaining budget reduces by RAW spend? 
    // The spec says: Remaining Budget = Budget - cumulative RAW spend.
    // Wait, let's re-read the markdown. "Budget - cumulative RAW spend (higher-ranked items)".
    // So you subtract the ACTUAL estimated Spend of what you allocate? 
    // OR do you subtract the RAW spend (meaning if I can't afford all, I still deduct exactly what I spend).
    // Let's deduct actual estimated spend.
    remainingBudget -= estimatedSpend;

    // Fulfilled short = inverse of raw formula
    // Final Units / (Cycle * Loss)
    const factor = (plan.cycleFactor * plan.lossFactor);
    const fulfilledShort = factor > 0 ? allocatedQty / factor : 0;
    
    // Annual Uplift = FulfilledShort * Rev * 12
    const annualUplift = fulfilledShort * plan.revenuePerCycle * 12;

    return {
      id: plan.id,
      name: plan.name,
      adjustedShort: plan.adjustedShort,
      rawUnits: plan.rawUnits,
      efficiency: plan.efficiency,
      allocatedQty,
      estimatedSpend,
      annualUplift,
    };
  });

  return allocatedItems;
}
