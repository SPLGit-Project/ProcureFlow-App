import { MASTER_HIERARCHY, HierarchyStructure } from './hierarchyData';
import { AttributeOption } from '../types';

export class HierarchyManager {
    static getPools(options?: AttributeOption[]): string[] {
        if (!options || options.length === 0) return Object.keys(MASTER_HIERARCHY).sort();
        return Array.from(new Set(options.filter(o => o.type === 'POOL' && o.activeFlag !== false).map(o => o.value))).sort();
    }

    static getCatalogs(pool: string, options?: AttributeOption[]): string[] {
        if (!options || options.length === 0) {
            if (!pool || !MASTER_HIERARCHY[pool]) return [];
            return Object.keys(MASTER_HIERARCHY[pool]).sort();
        }
        if (!pool) return [];
        
        // Find Pool ID
        const poolOpt = options.find(o => o.type === 'POOL' && o.value === pool);
        if (!poolOpt) return [];

        // Find Catalogs linked to this Pool
        return Array.from(new Set(
            options.filter(o => 
                o.type === 'CATALOG' && 
                o.activeFlag !== false && 
                (o.parentId === poolOpt.id || o.parentIds?.includes(poolOpt.id))
            ).map(o => o.value)
        )).sort();
    }

    static getTypes(pool: string, catalog: string, options?: AttributeOption[]): string[] {
        if (!options || options.length === 0) {
            if (!pool || !catalog || !MASTER_HIERARCHY[pool] || !MASTER_HIERARCHY[pool][catalog]) return [];
            return Object.keys(MASTER_HIERARCHY[pool][catalog]).sort();
        }
        if (!catalog) return [];

        // Find Catalog ID (Need to be careful about duplicates in different pools, but assuming unique names for now or filtered by context)
        // Ideally we should traverse down: Pool -> Catalog -> Type
        // For simplicity in this flat list, we'll try to find the catalog option that is child of the pool option
        
        const poolOpt = options.find(o => o.type === 'POOL' && o.value === pool);
        if (!poolOpt) return [];

        const catOpt = options.find(o => 
            o.type === 'CATALOG' && 
            o.value === catalog && 
            (o.parentId === poolOpt.id || o.parentIds?.includes(poolOpt.id))
        );
        if (!catOpt) return [];

        return Array.from(new Set(
            options.filter(o => 
                o.type === 'TYPE' && 
                o.activeFlag !== false && 
                (o.parentId === catOpt.id || o.parentIds?.includes(catOpt.id))
            ).map(o => o.value)
        )).sort();
    }

    static getCategories(pool: string, catalog: string, type: string, options?: AttributeOption[]): string[] {
        if (!options || options.length === 0) {
            if (!pool || !catalog || !type || 
                !MASTER_HIERARCHY[pool] || 
                !MASTER_HIERARCHY[pool][catalog] || 
                !MASTER_HIERARCHY[pool][catalog][type]) return [];
            return Object.keys(MASTER_HIERARCHY[pool][catalog][type]).sort();
        }
        if (!type) return [];

        // Traversal
        const poolOpt = options.find(o => o.type === 'POOL' && o.value === pool);
        if (!poolOpt) return [];

        const catOpt = options.find(o => 
            o.type === 'CATALOG' && 
            o.value === catalog && 
            (o.parentId === poolOpt.id || o.parentIds?.includes(poolOpt.id))
        );
        if (!catOpt) return [];

        const typeOpt = options.find(o => 
            o.type === 'TYPE' && 
            o.value === type && 
            (o.parentId === catOpt.id || o.parentIds?.includes(catOpt.id))
        );
        if (!typeOpt) return [];

        return Array.from(new Set(
            options.filter(o => 
                o.type === 'CATEGORY' && 
                o.activeFlag !== false && 
                (o.parentId === typeOpt.id || o.parentIds?.includes(typeOpt.id))
            ).map(o => o.value)
        )).sort();
    }

    static getSubCategories(pool: string, catalog: string, type: string, category: string, options?: AttributeOption[]): string[] {
        if (!options || options.length === 0) {
            if (!pool || !catalog || !type || !category ||
                !MASTER_HIERARCHY[pool] || 
                !MASTER_HIERARCHY[pool][catalog] || 
                !MASTER_HIERARCHY[pool][catalog][type] ||
                !MASTER_HIERARCHY[pool][catalog][type][category]) return [];
            return MASTER_HIERARCHY[pool][catalog][type][category].sort();
        }
        if (!category) return [];

        // Traversal
        const poolOpt = options.find(o => o.type === 'POOL' && o.value === pool);
        if (!poolOpt) return [];

        const catOpt = options.find(o => 
            o.type === 'CATALOG' && 
            o.value === catalog && 
            (o.parentId === poolOpt.id || o.parentIds?.includes(poolOpt.id))
        );
        if (!catOpt) return [];

        const typeOpt = options.find(o => 
            o.type === 'TYPE' && 
            o.value === type && 
            (o.parentId === catOpt.id || o.parentIds?.includes(catOpt.id))
        );
        if (!typeOpt) return [];

        const catNodeOpt = options.find(o => 
            o.type === 'CATEGORY' && 
            o.value === category && 
            (o.parentId === typeOpt.id || o.parentIds?.includes(typeOpt.id))
        );
        if (!catNodeOpt) return [];

        return Array.from(new Set(
            options.filter(o => 
                o.type === 'SUB_CATEGORY' && 
                o.activeFlag !== false && 
                (o.parentId === catNodeOpt.id || o.parentIds?.includes(catNodeOpt.id))
            ).map(o => o.value)
        )).sort();
    }

    // Helper to validate a full path
    static validatePath(pool: string, catalog: string, type: string, category: string, subCategory: string, options?: AttributeOption[]): boolean {
        const subs = this.getSubCategories(pool, catalog, type, category, options);
        return subs.includes(subCategory);
    }
}
