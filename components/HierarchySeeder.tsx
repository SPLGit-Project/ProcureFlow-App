
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AttributeOption, AttributeType } from '../types';

const RAW_DATA = `Administrative	Accommodation	Charges & Fees	Surcharge	Delivery
Administrative	Accommodation	Charges & Fees	Surcharge	Late
Administrative	Accommodation	Charges & Fees	Surcharge	Packing
Administrative	Accommodation	Charges & Fees	Surcharge	Pickup
Administrative	Accommodation	Charges & Fees	Surcharge	Service
Administrative	Health Care	Charges & Fees	Surcharge	Delivery
Administrative	Health Care	Charges & Fees	Surcharge	Rental
Administrative	Health Care	Charges & Fees	Surcharge	Supply
Administrative	Linen Hub	Charges & Fees	Mat	Bath
Administrative	Linen Hub	Charges & Fees	Towel	Bath
Administrative	Linen Hub	Charges & Fees	Towel	Face Washer
Administrative	Linen Hub	Charges & Fees	Towel	Hand
Administrative	Mining	Charges & Fees	Surcharge	Delivery
Administrative	Mining	Charges & Fees	Surcharge	Handling
COG	Accommodation	Bath Linen	Cloth	Face Washer
COG	Accommodation	Bath Linen	Curtains & Drapes	Shower
COG	Accommodation	Bath Linen	Mat	Bath
COG	Accommodation	Bath Linen	Robe	Bath
COG	Accommodation	Bath Linen	Rug	Bath
COG	Accommodation	Bath Linen	Sheet	Bath
COG	Accommodation	Bath Linen	Towel	Bath
COG	Accommodation	Bath Linen	Towel	Face
COG	Accommodation	Bath Linen	Towel	Face Washer
COG	Accommodation	Bath Linen	Towel	Hand
COG	Accommodation	Bath Linen	Towel	Pool
COG	Accommodation	Bed Linen	Bedspread	Custom
COG	Accommodation	Bed Linen	Blanket	COG
COG	Accommodation	Bed Linen	Blanket	Custom
COG	Accommodation	Bed Linen	Cover	Cushion
COG	Accommodation	Bed Linen	Cover	Ironing Board
COG	Accommodation	Bed Linen	Doonas & Quilts	Cover
COG	Accommodation	Bed Linen	Doonas & Quilts	Insert
COG	Accommodation	Bed Linen	Pillow Case	Custom
COG	Accommodation	Bed Linen	Pillow Case	Standard
COG	Accommodation	Bed Linen	Protector	Doona / Quilt
COG	Accommodation	Bed Linen	Protector	Mattress
COG	Accommodation	Bed Linen	Protector	Pillow
COG	Accommodation	Bed Linen	Protector	Pillow Case
COG	Accommodation	Bed Linen	Rags	COG
COG	Accommodation	Bed Linen	Rug	Knee
COG	Accommodation	Bed Linen	Runner	Bed
COG	Accommodation	Bed Linen	Sheet	Custom
COG	Accommodation	Bed Linen	Sheet	Double
COG	Accommodation	Bed Linen	Sheet	Flat
COG	Accommodation	Bed Linen	Sheet	Single
COG	Accommodation	Bed Linen	Sheet	Standard
COG	Accommodation	Bed Linen	Sheet	Top
COG	Accommodation	Bed Linen	Topper	Mattress
COG	Accommodation	Hospital Wear	Robe	Bath
COG	Accommodation	Mats	Mats	Bath
COG	Accommodation	Table Linen	Napkin	Serviette
COG	Accommodation	Work Wear	Clothing-Top	Shirt
COG	Food & Beverages	Cleaning	Mop	Head
COG	Food & Beverages	Kitchen Linen	Cover	Chair
COG	Food & Beverages	Kitchen Wear	Apron	Custom
COG	Food & Beverages	Table Linen	Napkin	Serviette
COG	Food & Beverages	Table Linen	Table Linen	Custom
COG	Food & Beverages	Table Linen	Table Linen	Trestle
COG	Health Care	Bath Linen	Curtains & Drapes	Custom
COG	Health Care	Bath Linen	Curtains & Drapes	Fensitrated
COG	Health Care	Bath Linen	Curtains & Drapes	Shower
COG	Health Care	Bath Linen	Mat	Floor
COG	Health Care	Bath Linen	Towel	Face Washer
COG	Health Care	Bath Linen	Towel	Hand
COG	Health Care	Bed Linen	Bedspread	Custom
COG	Health Care	Bed Linen	Blanket	COG
COG	Health Care	Bed Linen	Doonas & Quilts	Cover
COG	Health Care	Bed Linen	Doonas & Quilts	Insert
COG	Health Care	Bed Linen	Pillow Case	Custom
COG	Health Care	Bed Linen	Protector	Kylie
COG	Health Care	Bed Linen	Protector	Mattress
COG	Health Care	Bed Linen	Sheet	Cot
COG	Health Care	Bed Linen	Sheet	Custom
COG	Health Care	Bed Linen	Sheet	Fitted
COG	Health Care	Bed Linen	Sheet	Slide
COG	Health Care	Bed Linen	Sheet	Standard
COG	Health Care	Bed Linen	Sling	Custom
COG	Health Care	Bed Linen	Sling	Patient
COG	Health Care	Cleaning	Duster	High
COG	Health Care	Cleaning	Duster	Microfibre
COG	Health Care	Cleaning	Mop	Head
COG	Health Care	Cleaning	Mop	String
COG	Health Care	Hospital Wear	Apparel	T-Shirt
COG	Health Care	Hospital Wear	Baby	Feeder
COG	Health Care	Hospital Wear	Baby	Gown
COG	Health Care	Hospital Wear	Baby	Wrap
COG	Health Care	Hospital Wear	Clothing-Baby	Bodysuit
COG	Health Care	Hospital Wear	Clothing-Top	Adults
COG	Health Care	Hospital Wear	Gown	Patient
COG	Health Care	Hospital Wear	Hand Wear	Gloves-Heat Resistant
COG	Health Care	Hospital Wear	Hood	Counter
COG	Health Care	Hospital Wear	Robe	Bath
COG	Health Care	Hospital Wear	Scrubs-Bottom	Pants
COG	Health Care	Hospital Wear	Scrubs-Top	Top
COG	Health Care	Hospital Wear	Sling	Loop
COG	Health Care	Kitchen Linen	Towel	Tea
COG	Health Care	Kitchen Wear	Hand Wear	Oven Mitt
COG	Linen Hub	Bed Linen	Sheet	Custom
COG	Mining	Bath Linen	Curtains & Drapes	Custom
COG	Mining	Bath Linen	Curtains & Drapes	Shower
COG	Mining	Bath Linen	Mat	Bath
COG	Mining	Bath Linen	Sheet	Bath
COG	Mining	Bath Linen	Towel	Bath
COG	Mining	Bath Linen	Towel	Face Washer
COG	Mining	Bath Linen	Towel	Gym
COG	Mining	Bath Linen	Towel	Hand
COG	Mining	Bed Linen	Blanket	COG
COG	Mining	Bed Linen	Doonas & Quilts	Comforter
COG	Mining	Bed Linen	Doonas & Quilts	Cover
COG	Mining	Bed Linen	Doonas & Quilts	Insert
COG	Mining	Bed Linen	Pillow Case	Custom
COG	Mining	Bed Linen	Protector	Mattress
COG	Mining	Bed Linen	Protector	Pillow Case
COG	Mining	Bed Linen	Sheet	Custom
COG	Mining	Bed Linen	Sheet	Fitted
COG	Mining	Bed Linen	Sheet	Flat
COG	Mining	Work Wear	Clothing-Top	Overalls
COG	Theater	Surgeon Items	Gown	Surgeon
General Pool	Accommodation	Bath Linen	Curtains & Drapes	Shower
General Pool	Accommodation	Bath Linen	Mat	Bath
General Pool	Accommodation	Bath Linen	Rug	Bath
General Pool	Accommodation	Bath Linen	Sheet	Bath
General Pool	Accommodation	Bath Linen	Towel	Bath
General Pool	Accommodation	Bath Linen	Towel	Bath Mat
General Pool	Accommodation	Bath Linen	Towel	Face Washer
General Pool	Accommodation	Bath Linen	Towel	Hand
General Pool	Accommodation	Bath Linen	Towel	Pool
General Pool	Accommodation	Bathroom	Towel	Bath
General Pool	Accommodation	Bed Linen	Blanket	Cellular
General Pool	Accommodation	Bed Linen	Cover	Couch
General Pool	Accommodation	Bed Linen	Doonas & Quilts	Cover
General Pool	Accommodation	Bed Linen	Doonas & Quilts	Insert
General Pool	Accommodation	Bed Linen	Pillow	Case
General Pool	Accommodation	Bed Linen	Pillow Case	Circle
General Pool	Accommodation	Bed Linen	Pillow Case	Euro
General Pool	Accommodation	Bed Linen	Pillow Case	Firm
General Pool	Accommodation	Bed Linen	Pillow Case	Soft
General Pool	Accommodation	Bed Linen	Pillow Case	Standard
General Pool	Accommodation	Bed Linen	Protector	Mattress
General Pool	Accommodation	Bed Linen	Protector	Pinkies/Kylie
General Pool	Accommodation	Bed Linen	Sheet	Cot
General Pool	Accommodation	Bed Linen	Sheet	Fitted
General Pool	Accommodation	Bed Linen	Sheet	Flat
General Pool	Accommodation	Bed Linen	Sheet	Slide
General Pool	Accommodation	Bed Linen	Sheet	Standard
General Pool	Accommodation	Bed Linen	Sheet	Top
General Pool	Accommodation	Charges & Fees	Surcharge	Delivery
General Pool	Accommodation	Ex-Items	Bag	Laundry
General Pool	Accommodation	Ex-Items	Rags	Bag
General Pool	Accommodation	Ex-Items	Rags	Towels
General Pool	Accommodation	Hospital Wear	Gown	Short Sleeve
General Pool	Accommodation	Hospital Wear	Robe	Bath
General Pool	Accommodation	Hospital Wear	Shirt	Uniform
General Pool	Accommodation	Kitchen Linen	Cloth	Dorset
General Pool	Accommodation	Kitchen Linen	Cloth	Glass
General Pool	Accommodation	Kitchen Linen	Cloth	Microfiber
General Pool	Accommodation	Kitchen Linen	Cloth	Polish
General Pool	Accommodation	Kitchen Linen	Mat	Dust
General Pool	Accommodation	Kitchen Linen	Napkin	Serviette
General Pool	Accommodation	Kitchen Linen	Towel	Tea
General Pool	Accommodation	Kitchen Wear	Apron	Butcher
General Pool	Accommodation	Mats	Mats	Bath
General Pool	Accommodation	Table Linen	Mat	Place
General Pool	Accommodation	Table Linen	Napkin	Cocktail
General Pool	Accommodation	Table Linen	Napkin	Serviette
General Pool	Accommodation	Theatre	Scrubs-Top	Surgeon
General Pool	Food & Beverages	Apparel	Cap	Rubber
General Pool	Food & Beverages	Bath Linen	Towel	Bath
General Pool	Food & Beverages	Bath Linen	Towel	Salon
General Pool	Food & Beverages	Cleaning	Mop	Head
General Pool	Food & Beverages	Ex-Items	Rags	Tea Towels
General Pool	Food & Beverages	Kitchen Linen	Cloth	Glass
General Pool	Food & Beverages	Kitchen Linen	Cloth	Huck
General Pool	Food & Beverages	Kitchen Linen	Cloth	Table
General Pool	Food & Beverages	Kitchen Linen	Cloth	Tray
General Pool	Food & Beverages	Kitchen Linen	Mat	Dust
General Pool	Food & Beverages	Kitchen Linen	Table Linen	Overlay
General Pool	Food & Beverages	Kitchen Linen	Table Linen	Standard
General Pool	Food & Beverages	Kitchen Linen	Towel	Tea
General Pool	Food & Beverages	Kitchen Wear	Apron	Bib
General Pool	Food & Beverages	Kitchen Wear	Apron	Butcher
General Pool	Food & Beverages	Kitchen Wear	Apron	Waist
General Pool	Food & Beverages	Table Linen	Napkin	Serviette
General Pool	Food & Beverages	Table Linen	Table Linen	Crease-Resistant
General Pool	Food & Beverages	Table Linen	Table Linen	Momie
General Pool	Food & Beverages	Table Linen	Table Linen	Standard
General Pool	Food & Beverages	Table Linen	Table Linen	Trestle
General Pool	Food & Beverages	Table Linen	Table Linen	Visa
General Pool	Food & Beverages	Work Wear	Clothing-Bottom	Pants-Freezer
General Pool	Food & Beverages	Work Wear	Clothing-Top	Jacket-Freezer
General Pool	Food & Beverages	Work Wear	Uniform-Top	Shirt
General Pool	Health Care	Bath Linen	Curtains & Drapes	Draw
General Pool	Health Care	Bath Linen	Curtains & Drapes	Screen
General Pool	Health Care	Bath Linen	Curtains & Drapes	Shower
General Pool	Health Care	Bath Linen	Mat	Bath
General Pool	Health Care	Bath Linen	Towel	Bath
General Pool	Health Care	Bath Linen	Towel	Face Washer
General Pool	Health Care	Bath Linen	Towel	Hand
General Pool	Health Care	Bath Linen	Towel	Huck
General Pool	Health Care	Bed Linen	Baby	Blanket
General Pool	Health Care	Bed Linen	Baby	Cot
General Pool	Health Care	Bed Linen	Bedspread	Standard
General Pool	Health Care	Bed Linen	Blanket	Bassinette
General Pool	Health Care	Bed Linen	Blanket	Cellolite
General Pool	Health Care	Bed Linen	Blanket	Cellular
General Pool	Health Care	Bed Linen	Blanket	Cot
General Pool	Health Care	Bed Linen	Blanket	Sperry
General Pool	Health Care	Bed Linen	Doonas & Quilts	Cover
General Pool	Health Care	Bed Linen	Doonas & Quilts	Insert
General Pool	Health Care	Bed Linen	Pillow Case	Child
General Pool	Health Care	Bed Linen	Pillow Case	Standard
General Pool	Health Care	Bed Linen	Protector	Bedpad
General Pool	Health Care	Bed Linen	Protector	Kylie/Comfort
General Pool	Health Care	Bed Linen	Protector	Mattress
General Pool	Health Care	Bed Linen	Protector	Pinkie
General Pool	Health Care	Bed Linen	Protector	Pinkies
General Pool	Health Care	Bed Linen	Runner	Bed
General Pool	Health Care	Bed Linen	Sheet	Bassinette
General Pool	Health Care	Bed Linen	Sheet	Brake
General Pool	Health Care	Bed Linen	Sheet	Cot
General Pool	Health Care	Bed Linen	Sheet	Double
General Pool	Health Care	Bed Linen	Sheet	Draw
General Pool	Health Care	Bed Linen	Sheet	Envelope
General Pool	Health Care	Bed Linen	Sheet	Fitted
General Pool	Health Care	Bed Linen	Sheet	Single
General Pool	Health Care	Bed Linen	Sheet	Slide
General Pool	Health Care	Bed Linen	Sheet	Slip
General Pool	Health Care	Bed Linen	Sheet	Split
General Pool	Health Care	Bed Linen	Sheet	Standard
General Pool	Health Care	Bed Linen	Sheet	Top
General Pool	Health Care	Cleaning	Mop	Head
General Pool	Health Care	Cleaning	Mop	Pad
General Pool	Health Care	Cleaning	Mop	Screw
General Pool	Health Care	Feeding	Bib	Adult
General Pool	Health Care	Hospital Wear	Apparel	Pyjamas
General Pool	Health Care	Hospital Wear	Apparel	Scrub
General Pool	Health Care	Hospital Wear	Apron	Bib
General Pool	Health Care	Hospital Wear	Apron	Caress
General Pool	Health Care	Hospital Wear	Apron	Standard
General Pool	Health Care	Hospital Wear	Apron	Swab
General Pool	Health Care	Hospital Wear	Baby	Bib
General Pool	Health Care	Hospital Wear	Baby	Feeder
General Pool	Health Care	Hospital Wear	Baby	Gown
General Pool	Health Care	Hospital Wear	Baby	Nappy
General Pool	Health Care	Hospital Wear	Baby	Wrap
General Pool	Health Care	Hospital Wear	Clothing-Baby	Vest
General Pool	Health Care	Hospital Wear	Clothing-Bottom	Pants
General Pool	Health Care	Hospital Wear	Clothing-Bottom	Pyjamas
General Pool	Health Care	Hospital Wear	Clothing-Bottom	Shorts
General Pool	Health Care	Hospital Wear	Clothing-Top	Adults
General Pool	Health Care	Hospital Wear	Clothing-Top	Jacket-Stud
General Pool	Health Care	Hospital Wear	Clothing-Top	Jumper
General Pool	Health Care	Hospital Wear	Clothing-Top	Pyjamas
General Pool	Health Care	Hospital Wear	Curtain	Recycle
General Pool	Health Care	Hospital Wear	Gown	Custom
General Pool	Health Care	Hospital Wear	Gown	Dressing
General Pool	Health Care	Hospital Wear	Gown	Patient
General Pool	Health Care	Hospital Wear	Gown	Theatre
General Pool	Health Care	Hospital Wear	Gown	Utility
General Pool	Health Care	Hospital Wear	Hand Wear	Gloves
General Pool	Health Care	Hospital Wear	Robe	Bath
General Pool	Health Care	Hospital Wear	Rug	Bunny
General Pool	Health Care	Hospital Wear	Scrubs-Bottom	Pants
General Pool	Health Care	Hospital Wear	Scrubs-Top	Top
General Pool	Health Care	Hospital Wear	Uniform-Top	Shirt
General Pool	Health Care	Kitchen Linen	Cloth	Bench
General Pool	Health Care	Kitchen Linen	Cloth	Microfiber
General Pool	Health Care	Kitchen Linen	Cloth	Table
General Pool	Health Care	Kitchen Linen	Towel	Kitchen
General Pool	Health Care	Kitchen Linen	Towel	Tea
General Pool	Health Care	Table Linen	Napkin	Serviette
General Pool	Health Care	Theatre	Clothing-Bottom	Pants
General Pool	Health Care	Theatre	Clothing-Bottom	Surgeon
General Pool	Health Care	Theatre	Curtains & Drapes	Loose
General Pool	Health Care	Theatre	Curtains & Drapes	Mini
General Pool	Health Care	Theatre	Jacket	Warm Up
General Pool	Health Care	Theatre	Pack	Major
General Pool	Health Care	Theatre	Pack	Minor
General Pool	Health Care	Theatre	Pack	Urology
General Pool	Health Care	Theatre	Packs	Surgical
General Pool	Health Care	Theatre	Pop Up	Green
General Pool	Health Care	Theatre	Scrubs-Bottom	Pants
General Pool	Health Care	Theatre	Scrubs-Top	Jacket
General Pool	Health Care	Theatre	Scrubs-Top	Surgeon
General Pool	Health Care	Theatre	Scrubs-Top	Top
General Pool	Health Care	Theatre	Scrubs-Top	Unisex
General Pool	Health Care	Theatre	Scrubs-Top	Urology
General Pool	Health Care	Theatre	Theatre	Squares
General Pool	Linen Hub	Bath Linen	Towel	Bath
General Pool	Linen Hub	Bed Linen	Pillow Case	Standard
General Pool	Linen Hub	Bed Linen	Sheet	Standard
General Pool	Linen Hub	Bed Linen	Sheet	Top
General Pool	Linen Hub	Cleaning	Mop	Head
General Pool	Linen Hub	Kitchen Linen	Napkin	Serviette
General Pool	Mining	Bath Linen	Mat	Bath
General Pool	Mining	Bath Linen	Towel	Bath
General Pool	Mining	Bed Linen	Doonas & Quilts	Cover
General Pool	Mining	Bed Linen	Doonas & Quilts	Insert
General Pool	Mining	Bed Linen	Sheet	Standard
General Pool	Theater	Packs	Theater Pack	
General Pool	Theater	Surgeon Items	Gown	Surgeon
Logistics	Transport	Delivery	Inserts & Liners	Bin Liner
Logistics	Transport	Delivery	Inserts & Liners	Sheet
Logistics	Transport	Delivery	Linen Bags	Bag
Logistics	Transport	Delivery	Linen Bags	Reject
Logistics	Transport	Delivery	Linen Bags	Safety
Logistics	Transport	Delivery	Linen Bags	Soiled
Logistics	Transport	Delivery	Linen Bags	Standard
Logistics	Transport	Delivery	Linen Bags	Zip
Logistics	Transport	Delivery	Trolleys & Tubs	Cage
Logistics	Transport	Delivery	Trolleys & Tubs	Full
Logistics	Transport	Delivery	Trolleys & Tubs	Reject
Logistics	Transport	Delivery	Trolleys & Tubs	Rental
Logistics	Transport	Delivery	Trolleys & Tubs	Soiled
Rental	Accommodation	Bed Linen	Sheet	Flat
Rental	Linen Hub	Bath Linen	Towel	Bath
Rental	Linen Hub	Bed Linen	Blanket	Cellular
Rental	Linen Hub	Bed Linen	Blanket	Fibresmart
Rental	Linen Hub	Charges & Fees	Doonas & Quilts	Cover
Rental	Linen Hub	Cleaning	Mop	Head
Rental	Linen Hub	Theatre	Scrubs-Bottom	Pants
Rental	Linen Hub	Theatre	Scrubs-Top	Jacket
Rental	Linen Hub	Theatre	Scrubs-Top	Top`;

export default function HierarchySeeder() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);

    const log = (msg: string) => setStatus(prev => [...prev, msg]);

    const seed = async () => {
        setLoading(true);
        setStatus([]);
        setProgress(0);

        try {
            // 1. Fetch existing options
            log('Fetching existing attributes...');
            const { data: allOptions, error } = await supabase.from('attribute_options').select('*');
            if (error) throw error;

            const existingMap = new Map<string, any>();
            // Key: type:value (lowercase for matching)
            // Note: For duplicate values across different parents (e.g. "Towel" in Bath Linen vs Kitchen Linen), 
            // duplicates are allowed? 
            // The current DB schema might enforce uniqueness on Value? 
            // If uniqueness is on Value globally, we have a problem because "Towel" appears in multiple places.
            // Let's assume uniqueness is on (Type, Value). 
            // "Towel" as SubCategory in "Bath Linen" vs "Kitchen Linen".
            // The current schema probably doesn't handle same-name-different-parent well if uniqueness is global.
            // Let's check db definition if I could... but I can't.
            // I'll assume I should reuse the ID if it exists?
            // No, "Towel" under "Bath Linen" is conceptually different from "Towel" under "Kitchen Linen"?
            // Actually, in many systems "Towel" is just a tag.
            // But here it looks like a hierarchy.
            // If I reuse "Towel" ID, it will be linked to multiple parents.
            // That matches the `parentIds` array logic!
            
            allOptions?.forEach(opt => {
                existingMap.set(`${opt.type}:${opt.value.toLowerCase().trim()}`, opt);
            });

            const rows = RAW_DATA.split('\n').filter(r => r.trim());
            const total = rows.length;

            log(`Found ${total} rows to process.`);

            // Process sequentially to be safe
            for (let i = 0; i < total; i++) {
                const row = rows[i].split('\t').map(c => c.trim());
                if (row.length < 5) continue;

                const [poolName, catalogName, typeName, catName, subCatName] = row;
                
                // Keep track of IDs for this chain
                let poolId: string;
                let catalogId: string;
                let typeId: string;
                let catId: string;

                // 1. POOL
                poolId = await ensureOption('POOL', poolName, existingMap);
                
                // 2. CATALOG (parent: Pool)
                catalogId = await ensureOption('CATALOG', catalogName, existingMap, [poolId]);

                // 3. TYPE (parent: Catalog) -- NEW LEVEL
                typeId = await ensureOption('TYPE', typeName, existingMap, [catalogId]);

                // 4. CATEGORY (parent: Type)
                catId = await ensureOption('CATEGORY', catName, existingMap, [typeId]);

                // 5. SUB_CATEGORY (parent: Category)
                await ensureOption('SUB_CATEGORY', subCatName, existingMap, [catId]);

                setProgress(Math.round(((i + 1) / total) * 100));
            }

            log('Seeding complete!');

        } catch (e: any) {
            log(`Error: ${e.message}`);
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const ensureOption = async (
        type: AttributeType, 
        value: string, 
        map: Map<string, any>,
        parentIdsToAdd: string[] = []
    ): Promise<string> => {
        const key = `${type}:${value.toLowerCase()}`;
        let option = map.get(key);
        let id = option?.id;

        if (option) {
            // Check if we need to add new unique parentIds
            const currentParents = option.parent_ids || [];
            const newParents = parentIdsToAdd.filter(pid => !currentParents.includes(pid));
            
            if (newParents.length > 0) {
                // Update existing
                const updatedParents = [...currentParents, ...newParents];
                // Optimistically update map
                option.parent_ids = updatedParents;
                
                // DB Update
                const { error } = await supabase
                    .from('attribute_options')
                    .update({ parent_ids: updatedParents })
                    .eq('id', option.id);
                
                if (error) throw error;
                // log(`Updated parent for [${type}] ${value}`);
            }
        } else {
            // Create New
            const { data, error } = await supabase
                .from('attribute_options')
                .insert({
                    type,
                    value,
                    parent_ids: parentIdsToAdd,
                    label: value
                })
                .select()
                .single();
            
            if (error) throw error;
            if (!data) throw new Error('No data returned from insert');

            option = data;
            map.set(key, option);
            // log(`Created [${type}] ${value}`);
        }

        return option!.id;
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
            <h2 className="text-lg font-bold mb-4">Hierarchy Migration (5-Level)</h2>
            <div className="mb-4 text-sm text-gray-600">
                Found {RAW_DATA.split('\n').filter(r => r.trim()).length} rows in definitions.
            </div>
            
            <button
                id="start-seeding-btn"
                onClick={seed}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? `Processing ${progress}%...` : 'Start Seeding'}
            </button>

            <div className="mt-4 max-h-60 overflow-y-auto bg-gray-50 p-4 rounded text-xs font-mono">
                {status.map((s, i) => (
                    <div key={i}>{s}</div>
                ))}
            </div>
        </div>
    );
}
