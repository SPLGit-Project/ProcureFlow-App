import { supabase } from '../lib/supabaseClient';
import { AttributeOption } from '../types';

export const CATALOGS = [
    'Accommodation', 'Food & Beverages', 'Health Care', 'Linen Hub', 'Mining', 'Transport'
];

export const POOLS = [
    'COG', 'Logistics', 'Regular Pool'
];

export const UOMS = [
    'Each', 'Pack', 'Set', 'Ctn', 'Box', 'Kg', 'L', 'M', 'Roll', 'Pr' // Added common ones, user specific ones prioritized
];

// Transcribed from user screenshots
export const CATEGORIES = [
    'Apparel', 'Apron', 'Baby', 'Bag', 'Bedspread', 'Bib', 'Blanket', 'Cap', 'Cloth', 
    'Clothing-Baby', 'Clothing-Bottom', 'Clothing-Top', 'Consumables', 'Cover', 'Curtain', 
    'Curtains & Drapes', 'Doona Cover', 'Doonas & Quilts', 'Duster', 'Gown', 'Hand Wear', 
    'Hood', 'Hospitality', 'Inserts & Liners', 'Jacket', 'Linen Bags', 'Mat', 'Mats', 
    'Mop', 'Napkin', 'Pack', 'Packs', 'Pillow', 'Pillow Case', 'Pop Up', 'Protector', 
    'Rags', 'Robe', 'Rug', 'Runner', 'Scrubs-Bottom', 'Scrubs-Top', 'Sheet', 'Shirt', 
    'Sling', 'Surcharge', 'Table Linen', 'TBA', 'Textiles', 'Theater Pack', 'Theatre', 
    'Topper', 'Towel', 'Trolleys & Tubs', 'Uniform', 'Uniform-Top'
];

export const seedCatalogData = async () => {
    console.log('Starting Catalog Seeding...');
    let count = 0;

    const upsertOption = async (type: string, value: string) => {
        const { error } = await supabase.from('attribute_options').upsert({
            type,
            value,
            label: value, // Use value as label for now
            active_flag: true,
            updated_at: new Date().toISOString()
        }, { onConflict: 'type, value' });
        
        if (error) {
            console.error(`Failed to seed ${type} - ${value}:`, error);
        } else {
            count++;
        }
    };

    // 1. Catalogs
    for (const item of CATALOGS) await upsertOption('CATALOG', item);

    // 2. Pools
    for (const item of POOLS) await upsertOption('POOL', item);

    // 3. UOMs
    for (const item of UOMS) await upsertOption('UOM', item);

    // 4. Categories
    for (const item of CATEGORIES) await upsertOption('CATEGORY', item);

    console.log(`Seeding Complete. Upserted ${count} items.`);
    return count;
};
