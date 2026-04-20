import { calculateBuyingPlan } from '../utils/shortSupplyEngine';

function assertEquals(actual: number, expected: number, context: string) {
    if (Math.abs(actual - expected) > 0.01) {
        throw new Error(`Assertion failed in ${context}. Expected ${expected}, got ${actual}`);
    }
}

function runTests() {
    console.log("Running Short Supply Engine Tests...");

    const testItem = {
        id: '1',
        name: 'Test Towel',
        shortQty: 1000,
        starDays: 3,
        depreciationMonths: 24,
        shrinkagePercent: 5,
        revenuePerCycle: 0.5,
        purchasePrice: 5.0,
        weightKg: 0.5
    };

    // Test 1: Full Budget, 100% SS
    const result1 = calculateBuyingPlan([testItem], 50000, 100)[0];
    
    // Adjusted Short: 1000 * 1.0 = 1000
    // Cycle Factor: 3/30 = 0.1
    // Loss Factor: 1 + (12/24) + (5/100) = 1.55
    // Raw Units = ceil(1000 * 0.1 * 1.55) = 155
    assertEquals(result1.rawUnits, 155, "Test 1: Raw Units");

    // Annual Cycles = 365/3 = 121.666
    // Availability = min(1, 24/12) * (1 - 0.05) = 0.95
    // Uplift Per Unit = 0.5 * 121.666 * 0.95 = 57.791
    // Efficiency = 57.791 / 5.0 = 11.558
    assertEquals(result1.efficiency, 11.558, "Test 1: Efficiency");

    // Allocated Qty = 155 (since 50,000 / 5 = 10,000 which is > 155)
    assertEquals(result1.allocatedQty, 155, "Test 1: Allocated Qty");

    // Test 2: Constrained Budget
    // Only $500 available -> 500 / 5.0 = 100 units affordable
    const result2 = calculateBuyingPlan([testItem], 500, 100)[0];
    assertEquals(result2.allocatedQty, 100, "Test 2: Constrained Allocated Qty");
    
    console.log("All tests passed successfully.");
}

runTests();
