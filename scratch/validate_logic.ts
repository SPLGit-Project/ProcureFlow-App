// scratch/validate_logic.ts
// Run with: deno run scratch/validate_logic.ts

import { calculateBuyingPlan } from "../utils/shortSupplyEngine.ts";

const testContext = [
  {
    id: "PROOFOFCONCEPT-001",
    name: "Bath Towel White",
    shortQty: 1000,
    starDays: 3.0,
    depreciationMonths: 36,
    shrinkagePercent: 5,
    revenuePerCycle: 0.15,
    purchasePrice: 4.50,
    weightKg: 0.6
  }
];

const budget = 100000;
const ssPercent = 100;

console.log("--- Forensic Logic Validation ---");
console.log(`Input: Short=1000, STAR=3.0, Depr=36mo, Shrink=5%, Price=$4.50`);

const result = calculateBuyingPlan(testContext, budget, ssPercent);
const item = result[0];

console.log(`\nExpected Raw Units (ceil(1000 * 0.1 * 1.3833)): 139`);
console.log(`Actual Raw Units: ${item.rawUnits}`);

console.log(`\nExpected Efficiency: ~3.85`);
console.log(`Actual Efficiency: ${item.efficiency.toFixed(2)}`);

if (item.rawUnits === 139) {
  console.log("\nVERDICT: Logic matches legacy BI standards 1:1.");
} else {
  console.log("\nVERDICT: DISCREPANCY DETECTED.");
}
