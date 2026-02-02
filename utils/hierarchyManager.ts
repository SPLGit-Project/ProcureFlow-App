import { MASTER_HIERARCHY, HierarchyStructure } from './hierarchyData';

export class HierarchyManager {
    static getPools(): string[] {
        return Object.keys(MASTER_HIERARCHY).sort();
    }

    static getCatalogs(pool: string): string[] {
        if (!pool || !MASTER_HIERARCHY[pool]) return [];
        return Object.keys(MASTER_HIERARCHY[pool]).sort();
    }

    static getTypes(pool: string, catalog: string): string[] {
        if (!pool || !catalog || !MASTER_HIERARCHY[pool] || !MASTER_HIERARCHY[pool][catalog]) return [];
        return Object.keys(MASTER_HIERARCHY[pool][catalog]).sort();
    }

    static getCategories(pool: string, catalog: string, type: string): string[] {
        if (!pool || !catalog || !type || 
            !MASTER_HIERARCHY[pool] || 
            !MASTER_HIERARCHY[pool][catalog] || 
            !MASTER_HIERARCHY[pool][catalog][type]) return [];
        return Object.keys(MASTER_HIERARCHY[pool][catalog][type]).sort();
    }

    static getSubCategories(pool: string, catalog: string, type: string, category: string): string[] {
        if (!pool || !catalog || !type || !category ||
            !MASTER_HIERARCHY[pool] || 
            !MASTER_HIERARCHY[pool][catalog] || 
            !MASTER_HIERARCHY[pool][catalog][type] ||
            !MASTER_HIERARCHY[pool][catalog][type][category]) return [];
        return MASTER_HIERARCHY[pool][catalog][type][category].sort();
    }

    // Helper to validate a full path
    static validatePath(pool: string, catalog: string, type: string, category: string, subCategory: string): boolean {
        const subs = this.getSubCategories(pool, catalog, type, category);
        return subs.includes(subCategory);
    }
}
