import { supabase } from '../lib/supabaseClient.ts';
import { User, PORequest, Supplier, Item, Site, WorkflowStep, NotificationRule, RoleDefinition, SupplierCatalogItem, SupplierStockSnapshot, ApprovalEvent, POLineItem, DeliveryHeader, DeliveryLineItem, SupplierProductMap, ProductAvailability, AppNotification, AttributeOption, SystemAuditLog, PermissionId, FeatureFlags, MarginThresholds, SupplierContact, EmailIngestionQueueItem } from '../types.ts';
import { normalizeItemCode } from '../utils/normalization.ts';
import { buildItemSpecsWithPriceOptions, getDefaultItemPriceOption, normalizeItemPriceOptions } from '../utils/itemPricing.ts';
import { normalizeSupplierContacts } from '../utils/suppliers.ts';



// --- Fallback types for untyped Supabase results ---
type DbItemRow = { id: string; sku: string; name: string; description: string; unit_price: number; uom: string; upq: number; category: string; sub_category: string; stock_level: number; supplier_id: string; is_rfid: boolean; is_cog: boolean; sap_item_code_raw: string; sap_item_code_norm: string; range_name: string; stock_type: string; active_flag: boolean; created_at: string; updated_at: string; item_weight: number; item_pool: string; item_catalog: string; item_type: string; rfid_flag: boolean; item_colour: string; item_pattern: string; item_material: string; item_size: string; measurements: string; cog_flag: boolean; cog_customer: string; specs: Record<string, unknown> };
type DbSupplierRow = { id: string; name: string; contact_email: string; key_contact: string; phone: string; address: string; categories: string[]; contacts?: SupplierContact[] | null };
type DbSupplierProductMapRow = { id: string; supplier_id: string; product_id: string; supplier_sku: string; supplier_customer_stock_code: string; match_priority: number; pack_conversion_factor: number; mapping_status: SupplierProductMap['mappingStatus']; mapping_method: SupplierProductMap['mappingMethod']; confidence_score: number; mapping_justification: SupplierProductMap['mappingJustification']; manual_override: boolean; updated_at: string };
type DbProductAvailabilityRow = { id: string; product_id: string; supplier_id: string; available_units: number; available_order_qty: number; updated_at: string };
type DbCatalogItemRow = { id: string; item_id: string; supplier_id: string; supplier_sku: string; price: number };
type DbStockSnapshotRow = { id: string; supplier_id: string; supplier_sku: string; product_name: string; available_qty: number; stock_on_hand: number; committed_qty: number; back_ordered_qty: number; total_stock_qty: number; snapshot_date: string; source_report_name: string; customer_stock_code: string; range_name: string; category: string; sub_category: string; stock_type: string; carton_qty: number; soh_value_at_sell: number; sell_price: number; incoming_stock: SupplierStockSnapshot['incomingStock']; customer_stock_code_raw: string; customer_stock_code_norm: string; customer_stock_code_alt_norm: string };
type DbPORequestRow = { id: string; display_id: string; request_date: string; requester_id: string; requester: { name: string }; site_id: string; site: { name: string }; supplier_id: string; supplier: { name: string }; status: PORequest['status']; total_amount: number; approvals: { id: string; action: ApprovalEvent['action']; date: string; approver_name: string; comments: string }[]; lines: { id: string; item_id: string; item_name: string; sku: string; quantity_ordered: number; quantity_received: number; unit_price: number; total_price: number; concur_po_number: string }[]; deliveries: { id: string; date: string; docket_number: string; received_by: string; received_by_id: string; lines: { id: string; po_line_id: string; quantity: number; invoice_number: string; is_capitalised: boolean; capitalised_date: string; freight_amount: number }[] }[]; reason_for_request: PORequest['reasonForRequest']; customer_name: string; concur_request_number: string; po_lines: { concur_po_number: string }[]; comments: string };
type DbWorkflowStepRow = { id: string; step_name: string; approver_role: string; approver_type: WorkflowStep['approverType']; approver_id: string; condition_type: WorkflowStep['conditionType']; condition_value: number; order: number; is_active: boolean };
type DbNotificationRuleRow = { id: string; event_type: NotificationRule['eventType']; label: string; is_active: boolean; recipients: NotificationRule['recipients'] };
type DbAppNotificationRow = { id: string; user_id: string; title: string; message: string; is_read: boolean; link: string; created_at: string };
type DbAttributeOptionRow = { id: string; type: AttributeOption['type']; value: string; parent_id: string; parent_ids: string[]; active_flag: boolean; created_at: string; updated_at: string };
type DbUpdateResult = { select: (s: string, o: Record<string, unknown>) => Promise<{ error: Error | null, count: number | null }> };
type DbSystemAuditLogRow = { id: string; action_type: string; performed_by: string; performedByName?: string; summary: Record<string, unknown>; details: Record<string, unknown>; created_at: string; };
type DbUserRow = { id: string; auth_user_id: string; name: string; };
// -----------------------------------------------------------

type UserRoleRow = { role_id: string };

const uniqueRoleIds = (primaryRole?: string, roleIds?: string[]): string[] => {
    const roles = [primaryRole, ...(roleIds || [])].filter(Boolean) as string[];
    return Array.from(new Set(roles));
};

const syncUserRoles = async (userId: string, primaryRole?: string, roleIds?: string[]): Promise<void> => {
    const assignedRoles = uniqueRoleIds(primaryRole, roleIds);
    const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);
    if (deleteError) throw deleteError;

    if (assignedRoles.length === 0) return;

    const { error: insertError } = await supabase
        .from('user_roles')
        .insert(assignedRoles.map(roleId => ({ user_id: userId, role_id: roleId })));
    if (insertError) throw insertError;
};

export const db = {
    getRoles: async (): Promise<RoleDefinition[]> => {
        const { data, error } = await supabase.from('roles').select('*');
        if (error) throw error;
        return (data || []).map((r: { id: string; name: string; description: string; is_system: boolean; permissions: string[] }) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            isSystem: r.is_system,
            permissions: (r.permissions || []) as PermissionId[]
        }));
    },
    
    upsertRole: async (role: RoleDefinition): Promise<void> => {
        const { error } = await supabase.from('roles').upsert({
            id: role.id,
            name: role.name,
            description: role.description,
            is_system: role.isSystem,
            permissions: role.permissions
        });
        if (error) throw error;
    },

    deleteRole: async (id: string): Promise<void> => {
        const { error } = await supabase.from('roles').delete().eq('id', id);
        if (error) throw error;
    },

    getUserRoleIds: async (userId: string): Promise<string[]> => {
        const { data, error } = await supabase
            .from('user_roles')
            .select('role_id')
            .eq('user_id', userId);
        if (error) throw error;
        return Array.from(new Set((data || []).map((row: UserRoleRow) => row.role_id).filter(Boolean)));
    },

    getUsers: async (): Promise<User[]> => {
        const { data, error } = await supabase.from('users').select('*, user_roles(role_id)');
        if (error) throw error;
        return (data || []).map((u: { id: string; name: string; email: string; role_id: string; avatar: string; job_title: string; status: User['status']; created_at: string; site_ids: string[]; invited_at: string; invitation_expires_at: string; user_roles?: UserRoleRow[] }) => {
            const roleIds = uniqueRoleIds(u.role_id, (u.user_roles || []).map(row => row.role_id));
            return {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role_id,
            realRole: u.role_id,
            roleIds,
            avatar: u.avatar,
            jobTitle: u.job_title,
            status: u.status,
            createdAt: u.created_at,
            siteIds: u.site_ids || [],
            invitedAt: u.invited_at,
            invitationExpiresAt: u.invitation_expires_at
        };
        });
    },

    createUser: async (user: User): Promise<void> => {
        const { error } = await supabase.from('users').insert({
            id: user.id,
            email: user.email,
            name: user.name,
            role_id: user.role,
            avatar: user.avatar,
            job_title: user.jobTitle,
            status: user.status || 'PENDING_APPROVAL',
            created_at: user.createdAt || new Date().toISOString(),
            site_ids: user.siteIds || [],
            invited_at: user.invitedAt,
            invitation_expires_at: user.invitationExpiresAt
        });
        if (error) throw error;
        await syncUserRoles(user.id, user.role, user.roleIds);
    },

    upsertUser: async (user: User): Promise<void> => {
        const { error } = await supabase.from('users').upsert({
            id: user.id,
            email: user.email,
            name: user.name,
            role_id: user.role,
            avatar: user.avatar,
            job_title: user.jobTitle,
            status: user.status || 'PENDING_APPROVAL',
            created_at: user.createdAt || new Date().toISOString(),
            site_ids: user.siteIds || [],
            invited_at: user.invitedAt,
            invitation_expires_at: user.invitationExpiresAt
        }, { onConflict: 'id' });
        if (error) throw error;
        await syncUserRoles(user.id, user.role, user.roleIds);
    },
    
    updateUserStatus: async (id: string, status: string): Promise<void> => {
        const { error } = await supabase.from('users').update({ status }).eq('id', id);
        if (error) throw error;
    },

    // Lookup auth user by email - returns the auth.users ID if exists
    getAuthUserByEmail: async (email: string): Promise<string | null> => {
        // We can't directly query auth.users from client side, but we can check
        // by attempting to get user info via admin or using our public.users table + 
        // a join. Since public.users should sync with auth.users, we check if email exists there.
        // However, for orphaned auth users (deleted from public but not auth), we need
        // a server-side function. For now, we use an RPC if available.
        
        const normalizedEmail = email.toLowerCase();
        // Fallback: Try to find in public.users first (case-insensitive)
        const { data } = await supabase
            .from('users')
            .select('id')
            .ilike('email', normalizedEmail)
            .limit(1)
            .maybeSingle();
        
        return data?.id || null;
    },

    // Smart user creation that handles email conflicts gracefully
    createOrUpdateUserByEmail: async (user: User): Promise<void> => {
        const normalizedEmail = user.email?.toLowerCase();
        
        // First check if user already exists by email
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .ilike('email', normalizedEmail || '')
            .limit(1)
            .maybeSingle();
        
        if (existingUser) {
            // User exists - update their record instead of creating new
            const { error } = await supabase.from('users').update({
                name: user.name,
                role_id: user.role,
                avatar: user.avatar,
                job_title: user.jobTitle,
                status: user.status || 'APPROVED',
                site_ids: user.siteIds || [],
                invited_at: user.invitedAt,
                invitation_expires_at: user.invitationExpiresAt
            }).eq('id', existingUser.id);
            
            if (error) throw error;
            await syncUserRoles(existingUser.id, user.role, user.roleIds);
        } else {
            // New user - insert
            const { error } = await supabase.from('users').insert({
                id: user.id,
                email: normalizedEmail,
                name: user.name,
                role_id: user.role,
                avatar: user.avatar,
                job_title: user.jobTitle,
                status: user.status || 'PENDING_APPROVAL',
                created_at: user.createdAt || new Date().toISOString(),
                site_ids: user.siteIds || [],
                invited_at: user.invitedAt,
                invitation_expires_at: user.invitationExpiresAt
            });
            if (error) throw error;
            await syncUserRoles(user.id, user.role, user.roleIds);
        }
    },

    getSites: async (): Promise<Site[]> => {
        const { data, error } = await supabase.from('sites').select('*');
        if (error) throw error;
        return (data || []).map((s: { id: string; name: string; suburb: string; address: string; state: string; zip: string; contact_person: string }) => ({
            id: s.id,
            name: s.name,
            suburb: s.suburb,
            address: s.address,
            state: s.state,
            zip: s.zip,
            contactPerson: s.contact_person
        }));
    },

    addSite: async (s: Site): Promise<void> => {
        const { error } = await supabase.from('sites').insert({
            id: s.id,
            name: s.name,
            suburb: s.suburb,
            address: s.address,
            state: s.state,
            zip: s.zip,
            contact_person: s.contactPerson
        });
        if (error) throw error;
    },

    updateSite: async (s: Site): Promise<void> => {
        const { error } = await supabase.from('sites').update({
            name: s.name,
            suburb: s.suburb,
            address: s.address,
            state: s.state,
            zip: s.zip,
            contact_person: s.contactPerson
        }).eq('id', s.id);
        if (error) throw error;
    },

    deleteSite: async (id: string): Promise<void> => {
        // Orphan guard (Fix F6): block delete if active POs reference this site
        const { count, error: countErr } = await supabase
            .from('po_requests')
            .select('id', { count: 'exact', head: true })
            .eq('site_id', id);
        if (countErr) throw countErr;
        if (count && count > 0) {
            throw new Error(`Cannot delete site: ${count} purchase request(s) are linked to it. Reassign or archive them first.`);
        }
        const { error } = await supabase.from('sites').delete().eq('id', id);
        if (error) throw error;
    },

    getSuppliers: async (): Promise<Supplier[]> => {
        const { data, error } = await supabase.from('suppliers').select('*');
        if (error) throw error;
        return data.map((s: DbSupplierRow) => {
            const supplier = {
                id: s.id,
                name: s.name,
                contactEmail: s.contact_email || '',
                keyContact: s.key_contact || '',
                phone: s.phone || '',
                address: s.address || '',
                categories: s.categories || [],
                contacts: s.contacts || []
            };
            const contacts = normalizeSupplierContacts(supplier);
            const primaryContact = contacts.find(contact => contact.isPrimary) || contacts[0];
            return {
                ...supplier,
                keyContact: supplier.keyContact || primaryContact?.name || '',
                contactEmail: supplier.contactEmail || primaryContact?.email || '',
                phone: supplier.phone || primaryContact?.phone || '',
                contacts
            };
        });
    },

    addSupplier: async (s: Supplier): Promise<void> => {
        const { error } = await supabase.from('suppliers').insert({
            id: s.id,
            name: s.name,
            contact_email: s.contactEmail,
            key_contact: s.keyContact,
            phone: s.phone,
            address: s.address,
            categories: s.categories,
            contacts: normalizeSupplierContacts(s)
        });
        if (error) throw error;
    },

    updateSupplier: async (s: Supplier): Promise<void> => {
        const { error } = await supabase.from('suppliers').update({
            name: s.name,
            contact_email: s.contactEmail,
            key_contact: s.keyContact,
            phone: s.phone,
            address: s.address,
            categories: s.categories,
            contacts: normalizeSupplierContacts(s)
        }).eq('id', s.id);
        if (error) throw error;
    },

    deleteSupplier: async (id: string): Promise<void> => {
        // Orphan guard (Fix F6): block delete if active POs reference this supplier
        const { count, error: countErr } = await supabase
            .from('po_requests')
            .select('id', { count: 'exact', head: true })
            .eq('supplier_id', id);
        if (countErr) throw countErr;
        if (count && count > 0) {
            throw new Error(`Cannot delete supplier: ${count} purchase request(s) are linked to it. Close or reassign them first.`);
        }
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) throw error;
    },

    getItems: async (): Promise<Item[]> => {
        // Fetch ALL items using pagination to avoid Supabase's default 1000-row limit
        let allData: DbItemRow[] = [];
        let from = 0;
        const batchSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .range(from, from + batchSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            if (data.length < batchSize) break; // Last page
            from += batchSize;
        }
        return allData.map((i: DbItemRow) => {
            const mappedItem: Item = {
                id: i.id,
                sku: i.sku,
                name: i.name,
                description: i.description,
                unitPrice: Number(i.unit_price || 0),
                uom: i.uom,
                upq: i.upq,
                category: i.category,
                subCategory: i.sub_category,
                stockLevel: i.stock_level,
                supplierId: i.supplier_id,
                isRfid: i.is_rfid,
                isCog: i.is_cog,
                
                // Normalize
                sapItemCodeRaw: i.sap_item_code_raw,
                sapItemCodeNorm: i.sap_item_code_norm,
                
                // Categorization
                rangeName: i.range_name,
                stockType: i.stock_type,
                activeFlag: i.active_flag,
                createdAt: i.created_at,
                updatedAt: i.updated_at,
                
                // Extended Attributes (Master Data)
                itemWeight: i.item_weight,
                itemPool: i.item_pool,
                itemCatalog: i.item_catalog,
                itemType: i.item_type,
                rfidFlag: i.rfid_flag,
                itemColour: i.item_colour,
                itemPattern: i.item_pattern,
                itemMaterial: i.item_material,
                itemSize: i.item_size,
                measurements: i.measurements,
                cogFlag: i.cog_flag,
                cogCustomer: i.cog_customer,
                
                specs: i.specs
            };

            const priceOptions = normalizeItemPriceOptions(mappedItem);
            const defaultPrice = getDefaultItemPriceOption({ ...mappedItem, priceOptions }).price;

            return {
                ...mappedItem,
                unitPrice: defaultPrice,
                priceOptions,
                specs: {
                    ...(mappedItem.specs || {}),
                    priceOptions
                }
            };
        });
    },

    getItemImportConfig: async (): Promise<Record<string, unknown>> => {
        const { data, error } = await supabase.from('app_config').select('value').eq('key', 'item_import_config').single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = Row not found
        return data?.value || { overwrite_fields: {} };
    },

    updateItemImportConfig: async (config: Record<string, unknown>): Promise<void> => {
        const { error } = await supabase.from('app_config').upsert({
            key: 'item_import_config',
            value: config,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    },

    getTeamsConfig: async (): Promise<string> => {
        const { data, error } = await supabase.from('app_config').select('value').eq('key', 'teams_config').single();
        if (error && error.code !== 'PGRST116') throw error;
        return data?.value?.webhookUrl || '';
    },

    updateTeamsConfig: async (webhookUrl: string): Promise<void> => {
        const { error } = await supabase.from('app_config').upsert({
            key: 'teams_config',
            value: { webhookUrl },
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    },

    getFeatureFlags: async (): Promise<FeatureFlags> => {
        const keys = [
            'preview_enabled', 'preview_write_block', 'go_live_enabled',
            'ui_revamp_enabled', 'smart_buying_v2_enabled', 'integrations_enabled',
            'approved_catalogue_enforced'
        ];
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', keys);
        if (error && error.code !== 'PGRST116') throw error;
        const map: Record<string, boolean> = {};
        (data || []).forEach((row: { key: string; value: unknown }) => {
            map[row.key] = row.value === true || row.value === 'true';
        });
        return {
            previewEnabled:             map['preview_enabled']              ?? false,
            previewWriteBlock:          map['preview_write_block']          ?? true,
            goLiveEnabled:              map['go_live_enabled']              ?? false,
            uiRevampEnabled:            map['ui_revamp_enabled']            ?? false,
            smartBuyingV2Enabled:       map['smart_buying_v2_enabled']      ?? false,
            integrationsEnabled:        map['integrations_enabled']         ?? false,
            approvedCatalogueEnforced:  map['approved_catalogue_enforced']  ?? false,
        };
    },

    updateFeatureFlag: async (key: keyof FeatureFlags, value: boolean): Promise<void> => {
        const dbKeyMap: Record<keyof FeatureFlags, string> = {
            previewEnabled:            'preview_enabled',
            previewWriteBlock:         'preview_write_block',
            goLiveEnabled:             'go_live_enabled',
            uiRevampEnabled:           'ui_revamp_enabled',
            smartBuyingV2Enabled:      'smart_buying_v2_enabled',
            integrationsEnabled:       'integrations_enabled',
            approvedCatalogueEnforced: 'approved_catalogue_enforced',
        };
        const { error } = await supabase.from('app_config').upsert({
            key: dbKeyMap[key],
            value,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    },

    getMarginThresholds: async (): Promise<MarginThresholds> => {
        const DEFAULT: MarginThresholds = {
            defaultPercent: 25, standard: 25, contract: 20,
            customerSpecific: 20, promotional: 15, customerGroup: 25,
        };
        const { data } = await supabase
            .from('app_config').select('value').eq('key', 'margin_thresholds').maybeSingle();
        if (!data?.value) return DEFAULT;
        const v = data.value as Partial<MarginThresholds>;
        return { ...DEFAULT, ...v };
    },

    updateMarginThresholds: async (thresholds: Partial<MarginThresholds>): Promise<void> => {
        const existing = await db.getMarginThresholds();
        const { error } = await supabase.from('app_config').upsert({
            key: 'margin_thresholds',
            value: { ...existing, ...thresholds },
            updated_at: new Date().toISOString(),
        });
        if (error) throw error;
    },

    getBranding: async (): Promise<unknown | null> => {
        const { data, error } = await supabase.from('app_config').select('value').eq('key', 'branding').single();
        if (error && error.code !== 'PGRST116') throw error;
        return data?.value || null;
    },

    updateBranding: async (branding: unknown): Promise<void> => {
        const { error } = await supabase.from('app_config').upsert({
            key: 'branding',
            value: branding,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    },

    getMappings: async (): Promise<SupplierProductMap[]> => {
        const { data, error } = await supabase.from('supplier_product_map').select('*');
        if (error) throw error;
        return data.map((m: DbSupplierProductMapRow & { item?: { sku: string; name: string }; supplier?: { name: string } }) => ({
             id: m.id,
             supplierId: m.supplier_id,
             productId: m.product_id,
             supplierSku: m.supplier_sku,
             supplierCustomerStockCode: m.supplier_customer_stock_code,
             matchPriority: m.match_priority,
             packConversionFactor: m.pack_conversion_factor,
             mappingStatus: m.mapping_status,
             mappingMethod: m.mapping_method,
             confidenceScore: m.confidence_score,
             mappingJustification: m.mapping_justification,
             manualOverride: m.manual_override,
             updatedAt: m.updated_at
        }));
    },

    upsertMapping: async (mapping: SupplierProductMap): Promise<void> => {
        const { error } = await supabase.from('supplier_product_map').upsert({
             id: mapping.id,
             supplier_id: mapping.supplierId,
             product_id: mapping.productId,
             supplier_sku: mapping.supplierSku,
             supplier_customer_stock_code: mapping.supplierCustomerStockCode,
             match_priority: mapping.matchPriority,
             pack_conversion_factor: mapping.packConversionFactor,
             mapping_status: mapping.mappingStatus,
             mapping_method: mapping.mappingMethod,
             confidence_score: mapping.confidenceScore,
             mapping_justification: mapping.mappingJustification || {},
             manual_override: mapping.manualOverride || false,
             updated_at: new Date().toISOString()
        }, { onConflict: 'supplier_id,supplier_sku' });
        if (error) throw error;
    },

    upsertProductAvailability: async (availabilities: ProductAvailability[]): Promise<void> => {
        if (availabilities.length === 0) return;
        const dedupedMap = new Map<string, any>();
        availabilities.forEach(a => {
            const key = `${a.productId}:${a.supplierId}`;
            if (!dedupedMap.has(key)) {
                dedupedMap.set(key, {
                    id: a.id,
                    product_id: a.productId,
                    supplier_id: a.supplierId,
                    available_units: a.availableUnits,
                    available_order_qty: a.availableOrderQty,
                    updated_at: new Date().toISOString()
                });
            }
        });
        const payload = Array.from(dedupedMap.values());
        const { error } = await supabase.from('product_availability').upsert(payload, { onConflict: 'product_id,supplier_id' });
        if (error) throw error;
    },

    getProductAvailability: async (): Promise<ProductAvailability[]> => {
        const { data, error } = await supabase.from('product_availability').select('*');
        if (error) throw error;
        return data.map((a: DbProductAvailabilityRow) => ({
             id: a.id,
             productId: a.product_id,
             supplierId: a.supplier_id,
             availableUnits: a.available_units,
             availableOrderQty: a.available_order_qty,
             updatedAt: a.updated_at
        }));
    },

    backfillNormalization: async (): Promise<{ items: number, snapshots: number }> => {
        // 1. Backfill Items
        const { data: items, error: iErr } = await supabase.from('items').select('*');
        if (iErr) throw iErr;
        
        const itemUpdates = items.map((i: DbItemRow) => {
            const norm = normalizeItemCode(i.sku);
            return {
                ...i,
                sap_item_code_raw: i.sku,
                sap_item_code_norm: norm.normalized
            };
        });
        const { error: iUpdErr } = await supabase.from('items').upsert(itemUpdates);
        if (iUpdErr) throw iUpdErr;

        // 2. Backfill Snapshots
        const { data: snaps, error: sErr } = await supabase.from('stock_snapshots').select('*');
        if (sErr) throw sErr;

        const snapUpdates = snaps.map((s: DbStockSnapshotRow) => {
            const code = s.customer_stock_code || '';
            const norm = code ? normalizeItemCode(code) : { normalized: '', alternate: null };
            return {
                ...s,
                customer_stock_code_raw: code,
                customer_stock_code_norm: norm.normalized || null,
                customer_stock_code_alt_norm: norm.alternate || null
            };
        });
        const { error: sUpdErr } = await supabase.from('stock_snapshots').upsert(snapUpdates);
        if (sUpdErr) throw sUpdErr;

        return { items: itemUpdates.length, snapshots: snapUpdates.length };
    },

    getCatalog: async (): Promise<SupplierCatalogItem[]> => {
        const { data, error } = await supabase.from('catalog_items').select('*');
        if (error) throw error;
        return data.map((c: DbCatalogItemRow) => ({
            id: c.id,
            itemId: c.item_id,
            supplierId: c.supplier_id,
            supplierSku: c.supplier_sku,
            price: c.price
        }));
    },

    getStockSnapshots: async (): Promise<SupplierStockSnapshot[]> => {
        // Paginate to avoid Supabase's default 1000-row limit (SPL reports can exceed 1950 rows)
        let allData: DbStockSnapshotRow[] = [];
        let from = 0;
        const batchSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from('stock_snapshots')
                .select('*')
                .range(from, from + batchSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            if (data.length < batchSize) break;
            from += batchSize;
        }
        return allData.map((s: DbStockSnapshotRow) => ({
             id: s.id,
             supplierId: s.supplier_id,
             supplierSku: s.supplier_sku,
             productName: s.product_name,
             availableQty: s.available_qty,
             stockOnHand: s.stock_on_hand,
             committedQty: s.committed_qty,
             backOrderedQty: s.back_ordered_qty,
             totalStockQty: s.total_stock_qty,
             snapshotDate: s.snapshot_date,
             sourceReportName: s.source_report_name,
             customerStockCode: s.customer_stock_code,
             range: s.range_name,
             category: s.category,
             subCategory: s.sub_category,
             stockType: s.stock_type,
             cartonQty: s.carton_qty,
             sohValAtSell: s.soh_value_at_sell,
             sellPrice: s.sell_price,
             incomingStock: s.incoming_stock || [],
             customerStockCodeRaw: s.customer_stock_code_raw,
             customerStockCodeNorm: s.customer_stock_code_norm,
             customerStockCodeAltNorm: s.customer_stock_code_alt_norm
        }));
    },

    getPOs: async (siteIds?: string[]): Promise<PORequest[]> => {
        let query = supabase
            .from('po_requests')
            .select(`
                *,
                lines:po_lines(*),
                deliveries:deliveries(*, lines:delivery_lines(*)),
                approvals:po_approvals(*),
                supplier:suppliers(name),
                requester:users(name),
                site:sites(name)
            `)
            .order('created_at', { ascending: false });

        if (siteIds && siteIds.length > 0) {
            query = query.in('site_id', siteIds);
        } else if (siteIds && siteIds.length === 0) {
            return [];
        }

        const { data } = await query;

        return data.map((p: DbPORequestRow) => ({
            id: p.id,
            displayId: p.display_id,
            requestDate: p.request_date,
            requesterId: p.requester_id,
            requesterName: p.requester?.name || 'Unknown',
            siteId: p.site_id,
            site: p.site?.name || 'Unknown Site', 
            supplierId: p.supplier_id,
            supplierName: p.supplier?.name || 'Unknown',
            status: p.status,
            totalAmount: p.total_amount || 0,
            approvalHistory: (p.approvals || []).map((a: DbPORequestRow['approvals'][0]) => ({
                id: a.id,
                action: a.action,
                date: a.date,
                approverName: a.approver_name,
                comments: a.comments
            })),
            lines: (p.lines || []).map((l: DbPORequestRow['lines'][0]) => ({
                id: l.id,
                itemId: l.item_id,
                itemName: l.item_name,
                sku: l.sku,
                quantityOrdered: l.quantity_ordered || 0,
                quantityReceived: l.quantity_received || 0,
                unitPrice: l.unit_price || 0,
                totalPrice: l.total_price || 0,
                concurPoNumber: l.concur_po_number
            })),
            deliveries: (p.deliveries || []).map((d: DbPORequestRow['deliveries'][0]) => ({
                id: d.id,
                date: d.date,
                docketNumber: d.docket_number,
                receivedBy: d.received_by,
                receivedById: d.received_by_id,
                lines: (d.lines || []).map((dl: DbPORequestRow['deliveries'][0]['lines'][0]) => ({
                    id: dl.id,
                    poLineId: dl.po_line_id,
                    quantity: dl.quantity,
                    invoiceNumber: dl.invoice_number,
                    isCapitalised: dl.is_capitalised,
                    capitalisedDate: dl.capitalised_date,
                    freightAmount: dl.freight_amount
                }))
            })),
            reasonForRequest: p.reason_for_request,
            customerName: p.customer_name,
            concurRequestNumber: p.concur_request_number,
            concurPoNumber: Array.from(new Set((p.lines || []).map((l: { concur_po_number: string }) => l.concur_po_number).filter(Boolean))).join(', ') || undefined,
            comments: p.comments
        }));
    },

    getWorkflowSteps: async (): Promise<WorkflowStep[]> => {
        const { data, error } = await supabase.from('workflow_steps').select('*').order('order');
        if (error) throw error;
        return data.map((w: DbWorkflowStepRow) => ({
            id: w.id,
            stepName: w.step_name,
            approverRole: w.approver_role,
            approverType: w.approver_type || 'ROLE',
            approverId: w.approver_id || w.approver_role,
            conditionType: w.condition_type,
            conditionValue: w.condition_value,
            order: w.order,
            isActive: w.is_active
        }));
    },

    getNotificationRules: async (): Promise<NotificationRule[]> => {
        const { data, error } = await supabase.from('notification_settings').select('*');
        if (error) throw error;
        return data.map((n: DbNotificationRuleRow) => ({
            id: n.id,
            eventType: n.event_type,
            label: n.label,
            isActive: n.is_active,
            recipients: n.recipients || [] // JSONB column
        }));
    },

    upsertWorkflowStep: async (step: WorkflowStep): Promise<void> => {
        const { error } = await supabase.from('workflow_steps').upsert({
            id: step.id,
            step_name: step.stepName,
            approver_role: step.approverRole, // Maintain for backward compatibility if needed
            approver_type: step.approverType,
            approver_id: step.approverId,
            condition_type: step.conditionType,
            condition_value: step.conditionValue,
            order: step.order,
            is_active: step.isActive
        });
        if (error) throw error;
    },

    deleteWorkflowStep: async (id: string): Promise<void> => {
        const { error } = await supabase.from('workflow_steps').delete().eq('id', id);
        if (error) throw error;
    },

    upsertNotificationRule: async (rule: NotificationRule): Promise<void> => {
        const { error } = await supabase.from('notification_settings').upsert({
            id: rule.id,
            event_type: rule.eventType,
            label: rule.label,
            is_active: rule.isActive,
            recipients: rule.recipients
        });
        if (error) throw error;
    },

    deletePO: async (id: string): Promise<void> => {
        // Delegates to the server-side RPC which runs all cascade deletes
        // atomically inside a single PostgreSQL transaction (Fix F1).
        // The RPC also enforces: auth ownership, status guard (non-admins can only
        // delete DRAFT/PENDING), and writes an audit log entry.
        const { error } = await supabase.rpc('delete_po_and_cascade', { p_po_id: id });
        if (error) throw error;
    },

    deleteNotificationRule: async (id: string): Promise<void> => {
        const { error } = await supabase.from('notification_settings').delete().eq('id', id);
        if (error) throw error;
    },

    addNotification: async (notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): Promise<void> => {
        const { error } = await supabase.from('user_notifications').insert({
            user_id: notif.userId,
            title: notif.title,
            message: notif.message,
            link: notif.link
        });
        if (error) throw error;
    },

    getUserNotifications: async (userId: string): Promise<AppNotification[]> => {
        const { data, error } = await supabase
            .from('user_notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) throw error;
        return data.map((n: DbAppNotificationRow) => ({
            id: n.id,
            userId: n.user_id,
            title: n.title,
            message: n.message,
            isRead: n.is_read,
            link: n.link,
            createdAt: n.created_at
        }));
    },

    markNotificationRead: async (id: string): Promise<void> => {
        // Fix M1: surface error rather than silently discarding it
        const { error } = await supabase
            .from('user_notifications')
            .update({ is_read: true })
            .eq('id', id);
        if (error) console.warn('markNotificationRead failed (non-fatal):', error);
    },

    createPO: async (po: PORequest): Promise<string> => {
        // Use the atomic RPC to ensure all parts of the PO are created in a single transaction (Fix F2).
        // This also bypasses RLS restrictions on po_lines for non-admin users via SECURITY DEFINER.
        const header = {
            request_date: po.requestDate,
            requester_id: po.requesterId,
            site_id: po.siteId,
            supplier_id: po.supplierId,
            status: po.status,
            total_amount: po.totalAmount,
            customer_name: po.customerName,
            reason_for_request: po.reasonForRequest,
            comments: po.comments
        };

        const lines_data = po.lines.map(l => ({
            id: l.id,
            item_id: l.itemId,
            sku: l.sku,
            item_name: l.itemName,
            quantity_ordered: l.quantityOrdered,
            quantity_received: l.quantityReceived || 0,
            unit_price: l.unitPrice,
            total_price: l.totalPrice,
            concur_po_number: l.concurPoNumber
        }));

        const approval = po.approvalHistory && po.approvalHistory.length > 0 ? {
            approver_id: po.requesterId, 
            approver_name: po.approvalHistory[0].approverName,
            action: po.approvalHistory[0].action,
            date: po.approvalHistory[0].date,
            comments: po.approvalHistory[0].comments
        } : null;

        const { data, error } = await supabase.rpc('create_po_atomic', {
            p_request_id: po.id,
            p_header: header,
            p_lines: lines_data,
            p_approval: approval
        });

        if (error) {
            console.error('Failed to create PO atomic:', error);
            throw error;
        }

        return data || po.id;
    },
    

    updatePODetails: async (id: string, details: { clientName?: string, reasonForRequest?: string, comments?: string }): Promise<void> => {
        const { error } = await supabase.from('po_requests').update({
            customer_name: details.clientName,
            reason_for_request: details.reasonForRequest,
            comments: details.comments
        }).eq('id', id);
        if (error) throw error;
    },

    updatePendingPO: async (
        poId: string,
        updates: {
            requesterId?: string;
            customerName?: string;
            reasonForRequest?: string;
            comments?: string;
            concurRequestNumber?: string;
            concurPoNumber?: string;
            lines: POLineItem[];
        }
    ): Promise<void> => {
        const { data: existingPo, error: existingPoError } = await supabase
            .from('po_requests')
            .select('id, status, requester_id')
            .eq('id', poId)
            .single();

        if (existingPoError) throw existingPoError;
        if (!existingPo) throw new Error('Request not found.');
        // Status and ownership checks are handled by the RPC (update_pending_po_request)
        // which allows admins to edit any status. Only enforce requester check for non-admins.
        if (updates.requesterId && existingPo.requester_id !== updates.requesterId) {
            if (existingPo.status !== 'PENDING_APPROVAL') {
                throw new Error('Only pending approval requests can be edited.');
            }
            throw new Error('You can only edit your own pending request.');
        }

        const normalizedLines = (updates.lines || [])
            .map((line) => {
                const quantityOrdered = Math.max(1, Math.floor(Number(line.quantityOrdered) || 0));
                const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
                const totalPrice = Number((quantityOrdered * unitPrice).toFixed(2));

                return {
                    ...line,
                    quantityOrdered,
                    unitPrice,
                    totalPrice
                };
            })
            .filter((line) => Boolean(line.itemId));

        if (normalizedLines.length === 0) {
            throw new Error('A request must contain at least one item.');
        }

        const totalAmount = normalizedLines.reduce((sum, line) => sum + line.totalPrice, 0);
        // Wait! Let's ensure normalizedLines maps `concurPoNumber` to `concur_po_number` if it exists.
        const lineRows = normalizedLines.map((line) => ({
            id: line.id,
            item_id: line.itemId,
            sku: line.sku,
            item_name: line.itemName,
            quantity_ordered: line.quantityOrdered,
            unit_price: line.unitPrice,
            total_price: line.totalPrice,
            concur_po_number: line.concurPoNumber || updates.concurPoNumber
        }));

        const { error: rpcError } = await supabase.rpc('update_pending_po_request', {
            p_request_id: poId,
            p_header: {
                total_amount: Number(totalAmount.toFixed(2)),
                reason_for_request: updates.reasonForRequest,
                comments: updates.comments,
                customer_name: updates.customerName,
                concur_request_number: updates.concurRequestNumber
            },
            p_lines: lineRows
        });

        if (rpcError) throw rpcError;
    },

    addPOApproval: async (poId: string, approval: ApprovalEvent): Promise<void> => {
        const { error } = await supabase.from('po_approvals').insert({
            po_request_id: poId,
            approver_name: approval.approverName,
            action: approval.action,
            date: approval.date,
            comments: approval.comments
        });
        if (error) throw error;
    },

    updateDeliveryHeader: async (id: string, updates: { docketNumber?: string, date?: string, receivedBy?: string }): Promise<void> => {
        const payload: Record<string, unknown> = {};
        if (updates.docketNumber !== undefined) payload.docket_number = updates.docketNumber;
        if (updates.date !== undefined) payload.date = updates.date;
        if (updates.receivedBy !== undefined) payload.received_by = updates.receivedBy;

        const { error, count } = await (supabase
            .from('deliveries')
            .update(payload)
            .eq('id', id) as unknown as DbUpdateResult)
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        if (count === 0) throw new Error('Failed to update delivery header. Permission denied or record not found.');
    },

    updateApprovalHistory: async (poId: string, approvalId: string, updates: { approverName?: string, date?: string, comments?: string }): Promise<void> => {
        const payload: Record<string, unknown> = {};
        if (updates.approverName !== undefined) payload.approver_name = updates.approverName;
        if (updates.date !== undefined) payload.date = updates.date;
        if (updates.comments !== undefined) payload.comments = updates.comments;

        const { error, count } = await (supabase
            .from('po_approvals')
            .update(payload)
            .eq('id', approvalId)
            .eq('po_request_id', poId) as unknown as DbUpdateResult)
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        if (count === 0) throw new Error('Failed to update approval history. Record not found or permission denied.');
    },

    updateDeliveryLineFinanceInfo: async (lineId: string, updates: Partial<DeliveryLineItem>): Promise<void> => {
        const payload: Record<string, unknown> = {};
        if (updates.invoiceNumber !== undefined) payload.invoice_number = updates.invoiceNumber;
        if (updates.invoiceDate !== undefined) payload.invoice_date = updates.invoiceDate;
        if (updates.isCapitalised !== undefined) payload.is_capitalised = updates.isCapitalised;
        if (updates.capitalisedDate !== undefined) payload.capitalised_date = updates.capitalisedDate;

        const { error, count } = await (supabase
            .from('delivery_lines')
            .update(payload)
            .eq('id', lineId) as unknown as DbUpdateResult)
            .select('*', { count: 'exact', head: true });
            
        if (error) throw error;
        if (count === 0) throw new Error('Failed to update finance info. Permission denied.');
    },

    updateDeliveryLineQty: async (lineId: string, quantity: number): Promise<void> => {
        const { error } = await supabase.rpc('admin_update_delivery_line_qty', {
            p_line_id: lineId,
            p_new_qty: quantity
        });
        if (error) throw error;
    },

    deleteDelivery: async (deliveryId: string): Promise<void> => {
        const { error } = await supabase.rpc('delete_delivery', {
            p_delivery_id: deliveryId
        });
        if (error) throw error;
    },

    getInboundEmailConfig: async (): Promise<string> => {
        const { data, error } = await supabase.from('app_config').select('value').eq('key', 'inbound_email_config').single();
        if (error && error.code !== 'PGRST116') throw error;
        return data?.value?.email || 'reports@procureflow.com';
    },

    updateInboundEmailConfig: async (email: string): Promise<void> => {
        const { error } = await supabase.from('app_config').upsert({
            key: 'inbound_email_config',
            value: { email },
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    },

    addSnapshot: async (snapshot: SupplierStockSnapshot): Promise<void> => {
         const { error } = await supabase.from('stock_snapshots').insert({
              id: snapshot.id,
              supplier_id: snapshot.supplierId,
              supplier_sku: snapshot.supplierSku,
              product_name: snapshot.productName,
              available_qty: snapshot.availableQty,
              stock_on_hand: snapshot.stockOnHand,
              snapshot_date: snapshot.snapshotDate,
              source_report_name: snapshot.sourceReportName,
              customer_stock_code: snapshot.customerStockCode
         });
         if (error) throw error;
    },

    importStockSnapshot: async (supplierId: string, date: string, snapshots: SupplierStockSnapshot[]): Promise<void> => {
         const rows = snapshots.map(s => {
              const norm = normalizeItemCode(s.customerStockCode || s.supplierSku); 
              
              return {
                id: s.id, 
                supplier_id: s.supplierId,
                supplier_sku: s.supplierSku,
                product_name: s.productName,
                available_qty: s.availableQty,
                stock_on_hand: s.stockOnHand,
                snapshot_date: s.snapshotDate,
                source_report_name: s.sourceReportName,
                range_name: s.range,
                stock_type: s.stockType,
                carton_qty: s.cartonQty,
                category: s.category,
                sub_category: s.subCategory,
                committed_qty: s.committedQty,
                back_ordered_qty: s.backOrderedQty,
                soh_value_at_sell: s.sohValueAtSell,
                sell_price: s.sellPrice,
                total_stock_qty: s.totalStockQty,
                
                customer_stock_code_raw: s.customerStockCode || s.supplierSku,
                customer_stock_code_norm: norm.normalized,
                customer_stock_code_alt_norm: norm.alternate
            };
         });
         
         // Fix F3/H2: Delegate to the replace_stock_snapshot RPC which runs the
         // DELETE and all INSERTs inside a single atomic PostgreSQL transaction.
         // If any INSERT fails, the previous snapshot data is preserved.
         const { error } = await supabase.rpc('replace_stock_snapshot', {
             p_supplier_id: supplierId,
             p_date: date,
             p_rows: rows
         });
         if (error) throw error;
    },

    getEmailIngestionQueue: async (): Promise<EmailIngestionQueueItem[]> => {
        const { data, error } = await supabase
            .from('email_ingestion_queue')
            .select('*')
            .order('received_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((r: Record<string, any>) => ({
            id: r.id,
            messageId: r.message_id,
            attachmentName: r.attachment_name,
            storagePath: r.storage_path,
            fromAddress: r.from_address || undefined,
            subject: r.subject || undefined,
            receivedAt: r.received_at || undefined,
            detectedSupplierId: r.detected_supplier_id || undefined,
            detectedSupplierName: r.detected_supplier_name || undefined,
            reportDate: r.report_date || undefined,
            rowsImported: r.rows_imported ?? undefined,
            status: r.status,
            error: r.error || undefined,
            createdAt: r.created_at,
            processedAt: r.processed_at || undefined
        }));
    },

    updateEmailIngestionItem: async (id: string, patch: Partial<EmailIngestionQueueItem>): Promise<void> => {
        const row: Record<string, any> = {};
        if (patch.status !== undefined) row.status = patch.status;
        if (patch.error !== undefined) row.error = patch.error;
        if (patch.rowsImported !== undefined) row.rows_imported = patch.rowsImported;
        if (patch.reportDate !== undefined) row.report_date = patch.reportDate;
        if (patch.detectedSupplierId !== undefined) row.detected_supplier_id = patch.detectedSupplierId;
        if (patch.detectedSupplierName !== undefined) row.detected_supplier_name = patch.detectedSupplierName;
        if (patch.processedAt !== undefined) row.processed_at = patch.processedAt;
        const { error } = await supabase.from('email_ingestion_queue').update(row).eq('id', id);
        if (error) throw error;
    },

    // Atomically claim a queue row for processing. Returns true only if this
    // call moved it from PENDING to PROCESSING, guaranteeing exactly-once work
    // even if the drain runs in two tabs at once.
    claimEmailIngestionItem: async (id: string): Promise<boolean> => {
        const { data, error } = await supabase
            .from('email_ingestion_queue')
            .update({ status: 'PROCESSING' })
            .eq('id', id)
            .eq('status', 'PENDING')
            .select('id');
        if (error) throw error;
        return (data?.length ?? 0) > 0;
    },

    downloadInboxAttachment: async (storagePath: string): Promise<Blob> => {
        const { data, error } = await supabase.storage.from('supplier-inbox').download(storagePath);
        if (error) throw error;
        return data;
    },

    updateCatalogItem: async (item: SupplierCatalogItem): Promise<void> => {
        const { error } = await supabase.from('catalog_items').update({
             price: item.price,
             supplier_sku: item.supplierSku
        }).eq('id', item.id);
        if (error) throw error;
    },

    upsertProductMaster: async (items: Item[]): Promise<void> => {
         await db.upsertMasterItemsBulk(items);
    },

    getItemFieldRegistry: async (): Promise<Record<string, unknown>[]> => {
        const { data, error } = await supabase.from('item_field_registry').select('*').order('order_index');
        if (error) throw error;
        return data; 
    },

    getAttributeOptions: async (type?: string): Promise<AttributeOption[]> => {
        let query = supabase.from('attribute_options').select('*').eq('active_flag', true);
        if (type) {
            query = query.eq('type', type);
        }
        const { data, error } = await query.order('value');
        if (error) throw error;
        return data.map((o: DbAttributeOptionRow) => ({
             id: o.id,
             type: o.type,
             value: o.value,
             parentId: o.parent_id,
             parentIds: (o.parent_ids && o.parent_ids.length > 0) ? o.parent_ids : (o.parent_id ? [o.parent_id] : []),
             activeFlag: o.active_flag,
             createdAt: o.created_at,
             updatedAt: o.updated_at
        }));
    },

    upsertAttributeOption: async (option: Partial<AttributeOption>): Promise<void> => {
        // If we're updating value/type, check if we might clash with an existing inactive record
        if (option.value && option.type) {
            const { data: existing } = await supabase
                .from('attribute_options')
                .select('id, active_flag')
                .eq('type', option.type)
                .eq('value', option.value)
                .maybeSingle();

            if (existing && existing.id !== option.id) {
                if (!existing.active_flag) {
                    // Conflict with inactive record - delete the inactive one to allow the update/insert to proceed
                    await supabase.from('attribute_options').delete().eq('id', existing.id);
                } else {
                    // Conflict with an ACTIVE record - this is a legitimate naming clash
                    throw new Error(`A ${option.type.toLowerCase()} with the name "${option.value}" already exists.`);
                }
            }
        }

        const { error } = await supabase.from('attribute_options').upsert({
             id: option.id,
             type: option.type,
             value: option.value,
             parent_id: option.parentId,
             parent_ids: option.parentIds || [],
             active_flag: option.activeFlag !== undefined ? option.activeFlag : true,
             updated_at: new Date().toISOString()
        });
        if (error) throw error;
    },

    deleteAttributeOption: async (id: string): Promise<void> => {
        const { error } = await supabase.from('attribute_options').update({ active_flag: false }).eq('id', id);
        if (error) throw error;
    },

    upsertMasterItemsBulk: async (
        inputs: Partial<Item>[], 
        deactivateMissing: boolean = false,
        userId?: string
    ): Promise<{ created: number, updated: number, deactivated: number, skipped: number }> => {
        const [_, itemsRes] = await Promise.all([
            db.getItemImportConfig(),
            supabase.from('items').select('*')
        ]);
        
        if (itemsRes.error) throw itemsRes.error;
        const existingItems = itemsRes.data || [];
        const existingMap = new Map(existingItems.map((i: DbItemRow) => [i.sap_item_code_norm, i]));
        const existingSkuMap = new Map(existingItems.map((i: DbItemRow) => [i.sku, i]));
        
        const timestamp = new Date().toISOString();
        const payloadMap = new Map<string, Record<string, unknown>>(); // Keyed by id — natural deduplication
        let skipped = 0;
        const processedNorms = new Set<string>();
        const fieldKeys = new Set<string>();
        // Track which norms and SKUs have been assigned to prevent cross-collisions
        const usedNorms = new Map<string, string>(); // norm -> id
        const usedSkus = new Map<string, string>();  // sku  -> id
        
        for (const input of inputs) {
            Object.keys(input).forEach(k => fieldKeys.add(k));

            if (!input.sku) {
                skipped++;
                continue; 
            }
            const norm = normalizeItemCode(input.sku);
            if (!norm.normalized) {
                skipped++;
                continue;
            }
            
            processedNorms.add(norm.normalized);
            // Match by normalized code OR by Sku (last resort for legacy items)
            const existing = existingMap.get(norm.normalized) || existingSkuMap.get(input.sku);
            
            const itemId = existing ? existing.id : crypto.randomUUID();

            // Check if this norm or SKU would collide with a DIFFERENT item already in the payload
            const normOwner = usedNorms.get(norm.normalized);
            const skuOwner = usedSkus.get(input.sku);
            if ((normOwner && normOwner !== itemId) || (skuOwner && skuOwner !== itemId)) {
                skipped++; // Skip duplicate rows that would cause constraint violations
                continue;
            }
            
            const commonFields = {
                sku: input.sku,
                name: input.name,
                description: input.description,
                unit_price: input.unitPrice,
                uom: input.uom,
                category: input.category,
                sub_category: input.subCategory,
                range_name: input.rangeName,
                stock_type: input.stockType,
                upq: input.upq,
                item_weight: input.itemWeight,
                item_pool: input.itemPool,
                item_catalog: input.itemCatalog,
                item_type: input.itemType,
                rfid_flag: input.rfidFlag,
                item_colour: input.itemColour,
                item_pattern: input.itemPattern,
                item_material: input.itemMaterial,
                item_size: input.itemSize,
                measurements: input.measurements,
                cog_flag: input.cogFlag,
                cog_customer: input.cogCustomer,
                sap_item_code_raw: input.sku,
                sap_item_code_norm: norm.normalized,
                updated_at: timestamp,
                active_flag: true
            };

            const record: Record<string, unknown> = { id: itemId, ...commonFields };
            if (!existing) record.created_at = timestamp;

            // Map.set naturally deduplicates — last write wins for same id
            payloadMap.set(itemId, record);
            usedNorms.set(norm.normalized, itemId);
            usedSkus.set(input.sku, itemId);
        }
        
        const upsertPayload = Array.from(payloadMap.values());

        
        const registryPayload = Array.from(fieldKeys).map(k => ({
            field_key: k,
            label: k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
            data_type: typeof inputs[0][k as keyof Item],
            is_visible: true,
            is_filterable: true
        }));
        await supabase.from('item_field_registry').upsert(registryPayload, { onConflict: 'field_key' });
        
        if (upsertPayload.length > 0) {
            const batchSize = 1000;
            for (let i = 0; i < upsertPayload.length; i += batchSize) {
                const batch = upsertPayload.slice(i, i + batchSize);
                const { error } = await supabase.from('items').upsert(batch, { onConflict: 'id' });
                if (error) throw error;
            }
        }
        
        let deactivated = 0;
        if (deactivateMissing) {
             const missingIds = existingItems
                .filter((i: DbItemRow) => i.sap_item_code_norm && !processedNorms.has(i.sap_item_code_norm))
                .map((i: DbItemRow) => i.id);
                
             if (missingIds.length > 0) {
                 await supabase.from('items').update({ active_flag: false }).in('id', missingIds);
                 deactivated = missingIds.length;
             }
        }
        
        const result = {
            created: upsertPayload.length - existingItems.length,
            updated: existingItems.length,
            deactivated,
            skipped
        };

        if (userId) {
            try {
                await db.createAuditLog({
                    actionType: 'ITEM_IMPORT',
                    performedBy: userId,
                    summary: result,
                    details: {
                        inputCount: inputs.length,
                        deactivateMissingMode: deactivateMissing
                    }
                });
            } catch (auditErr) {
                console.warn('Audit log write failed (non-fatal):', auditErr);
            }
        }
        
        return result;
    },

    addItem: async (item: Item): Promise<void> => {
        const norm = normalizeItemCode(item.sku);
        const specsWithPricing = buildItemSpecsWithPriceOptions(item);
        const priceOptions = normalizeItemPriceOptions({ ...item, specs: specsWithPricing });
        const defaultPrice = getDefaultItemPriceOption({ ...item, specs: specsWithPricing, priceOptions }).price;
        const { error } = await supabase.from('items').insert({
            id: item.id,
            sku: item.sku,
            name: item.name,
            description: item.description,
            unit_price: defaultPrice,
            uom: item.uom,
            upq: item.upq,
            category: item.category,
            sub_category: item.subCategory,
            stock_level: item.stockLevel,
            supplier_id: item.supplierId || null,
            is_rfid: item.isRfid,
            is_cog: item.isCog,
            sap_item_code_raw: item.sku,
            sap_item_code_norm: norm.normalized,
            range_name: item.rangeName,
            stock_type: item.stockType,
            active_flag: item.activeFlag !== undefined ? item.activeFlag : true,
            created_at: item.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            item_weight: item.itemWeight,
            item_pool: item.itemPool,
            item_catalog: item.itemCatalog,
            item_type: item.itemType,
            rfid_flag: item.rfidFlag,
            item_colour: item.itemColour,
            item_pattern: item.itemPattern,
            item_material: item.itemMaterial,
            item_size: item.itemSize,
            measurements: item.measurements,
            cog_flag: item.cogFlag,
            cog_customer: item.cogCustomer,
            specs: specsWithPricing
        });
        if (error) throw error;
    },

    updateItem: async (item: Item): Promise<void> => {
        const norm = normalizeItemCode(item.sku);
        const specsWithPricing = buildItemSpecsWithPriceOptions(item);
        const priceOptions = normalizeItemPriceOptions({ ...item, specs: specsWithPricing });
        const defaultPrice = getDefaultItemPriceOption({ ...item, specs: specsWithPricing, priceOptions }).price;
        const { error, count } = await (supabase.from('items').update({
            sku: item.sku,
            name: item.name,
            description: item.description,
            unit_price: defaultPrice,
            uom: item.uom,
            upq: item.upq,
            category: item.category,
            sub_category: item.subCategory,
            stock_level: item.stockLevel,
            supplier_id: item.supplierId || null,
            is_rfid: item.isRfid,
            is_cog: item.isCog,
            sap_item_code_raw: item.sku,
            sap_item_code_norm: norm.normalized,
            range_name: item.rangeName,
            stock_type: item.stockType,
            active_flag: item.activeFlag,
            updated_at: new Date().toISOString(),
            item_weight: item.itemWeight,
            item_pool: item.itemPool,
            item_catalog: item.itemCatalog,
            item_type: item.itemType,
            rfid_flag: item.rfidFlag,
            item_colour: item.itemColour,
            item_pattern: item.itemPattern,
            item_material: item.itemMaterial,
            item_size: item.itemSize,
            measurements: item.measurements,
            cog_flag: item.cogFlag,
            cog_customer: item.cogCustomer,
            specs: specsWithPricing
        }).eq('id', item.id) as unknown as DbUpdateResult)
        .select('*', { count: 'exact', head: true });

        if (error) throw error;
        if (count === 0) throw new Error('Failed to update item. Permission denied or item not found.');
    },

    deleteItem: async (itemId: string): Promise<void> => {
        // Fix F6/H3: Orphan guard — prevent deleting items that are referenced by active PO lines.
        // This mirrors the same pattern used in deleteSite/deleteSupplier.
        const { count: poCount } = await supabase
            .from('po_lines')
            .select('id', { count: 'exact', head: true })
            .eq('item_id', itemId);
        if (poCount && poCount > 0) {
            throw new Error(`Cannot delete this item — it is referenced by ${poCount} PO line(s). Archive the item instead.`);
        }

        const { error } = await supabase.from('items').delete().eq('id', itemId);
        if (error) throw error;
    },

    archiveItem: async (itemId: string): Promise<void> => {
        const { error } = await supabase.from('items').update({ active_flag: false }).eq('id', itemId);
        if (error) throw error;
    },

    reactivateItem: async (itemId: string): Promise<void> => {
        const { error } = await supabase.from('items').update({ active_flag: true }).eq('id', itemId);
        if (error) throw error;
    },

    calculateMappingScore: (
        snap: DbStockSnapshotRow, 
        item: DbItemRow, 
        globalConsensus: Record<string, string[]>
    ): { score: number, justification: SupplierProductMap['mappingJustification'] } => {
        let score = 0;
        const justification: SupplierProductMap['mappingJustification'] = { components: [] };

        const normSnap = snap.customer_stock_code_norm;
        const normSupplierSku = normalizeItemCode(snap.supplier_sku || '').normalized;
        const normItem = item.sap_item_code_norm || normalizeItemCode(item.sku || '').normalized;
        const normItemSku = normalizeItemCode(item.sku || '').normalized;
        
        if (normSnap && [normItem, normItemSku].includes(normSnap) && normSnap !== '') {
            score += 2.0;
            justification.components.push({ type: 'SPL_ITEM_CODE_MATCH', score: 2.0, detail: `Supplier-provided SPL item code ${snap.customer_stock_code} matches internal item code` });
        } else if (normSupplierSku && [normItem, normItemSku].includes(normSupplierSku) && normSupplierSku !== '') {
            score += 0.95;
            justification.components.push({ type: 'SUPPLIER_SKU_MATCH', score: 0.95, detail: 'Supplier SKU matches item code after normalization' });
        } else if (snap.customer_stock_code && item.sku && snap.customer_stock_code.toLowerCase().trim() === item.sku.toLowerCase().trim()) {
            score += 2.0;
            justification.components.push({ type: 'SPL_ITEM_CODE_MATCH', score: 2.0, detail: `Supplier-provided SPL item code ${snap.customer_stock_code} exactly matches internal SKU` });
        } else if (snap.customer_stock_code_alt_norm && [normItem, normItemSku].includes(snap.customer_stock_code_alt_norm)) {
             score += 1.8;
             justification.components.push({ type: 'SPL_ITEM_CODE_ALT_MATCH', score: 1.8, detail: 'Supplier-provided SPL item code matches an alternate internal item code form' });
        }

        const tokenize = (str: string) => (str || '').toLowerCase().split(/[\s\-_,./]+/).map(t => t.replace(/s$/, '').trim()).filter(t => t.length > 2);
        const snapTokens = tokenize(snap.product_name);
        const itemTokens = tokenize(item.name);
        
        if (snapTokens.length > 0 && itemTokens.length > 0) {
            const intersection = snapTokens.filter(t => itemTokens.includes(t));
            const union = new Set([...snapTokens, ...itemTokens]);
            const jaccard = intersection.length / union.size;
            
            if (jaccard > 0) {
                const jScore = parseFloat((jaccard * 0.5).toFixed(2));
                score += jScore;
                justification.components.push({ type: 'TEXT_SIMILARITY', score: jScore, detail: `Jaccard similarity: ${(jaccard * 100).toFixed(1)}%` });
            }
        }

        if (snap.category && item.category && snap.category.toLowerCase() === item.category.toLowerCase()) {
            score += 0.2;
            justification.components.push({ type: 'ATTR_CATEGORY', score: 0.2, detail: 'Matching Category' });
        }

        if (snap.sub_category && item.sub_category && snap.sub_category.toLowerCase() === item.sub_category.toLowerCase()) {
            score += 0.15;
            justification.components.push({ type: 'ATTR_SUB_CATEGORY', score: 0.15, detail: 'Matching Sub Category' });
        }

        if (snap.stock_type && item.stock_type && snap.stock_type.toLowerCase() === item.stock_type.toLowerCase()) {
            score += 0.1;
            justification.components.push({ type: 'ATTR_STOCK_TYPE', score: 0.1, detail: 'Matching Stock Type' });
        }

        if (snap.range_name && item.range_name && snap.range_name.toLowerCase() === item.range_name.toLowerCase()) {
            score += 0.1;
            justification.components.push({ type: 'ATTR_RANGE', score: 0.1, detail: 'Matching Range' });
        }
        
        if (snap.sell_price && item.unit_price && item.unit_price > 0) {
            const diff = Math.abs(snap.sell_price - item.unit_price) / item.unit_price;
            if (diff < 0.1) {
                score += 0.1;
                justification.components.push({ type: 'FINANCE_PROXIMITY', score: 0.1, detail: `Price within 10% deviation` });
            }
        }

        const consensusMatches = [
            ...(globalConsensus[snap.supplier_sku] || []),
            ...(globalConsensus[normSupplierSku] || []),
            ...(globalConsensus[normSnap] || [])
        ];
        if (consensusMatches.includes(item.id)) {
            score += 0.5;
            justification.components.push({ type: 'GLOBAL_CONSENSUS', score: 0.5, detail: 'Confirmed by other suppliers' });
        }

        return { score: parseFloat(score.toFixed(2)), justification };
    },

    runAutoMapping: async (supplierId: string): Promise<{ confirmed: number, proposed: number }> => {
        const [snapshotsRes, itemsRes, existingMappingsRes, globalMappingsRes] = await Promise.all([
            supabase.from('stock_snapshots').select('*').eq('supplier_id', supplierId).order('snapshot_date', { ascending: false }),
            supabase.from('items').select('*').eq('active_flag', true),
            supabase.from('supplier_product_map').select('supplier_sku, supplier_customer_stock_code, product_id, mapping_status, manual_override').eq('supplier_id', supplierId),
            supabase.from('supplier_product_map').select('supplier_sku, supplier_customer_stock_code, product_id').eq('mapping_status', 'CONFIRMED').neq('supplier_id', supplierId)
        ]);

        if (!snapshotsRes.data || !itemsRes.data) return { confirmed: 0, proposed: 0 };
        
        const snapshots = snapshotsRes.data;
        const items = itemsRes.data;

        const globalConsensus: Record<string, string[]> = {};
        globalMappingsRes.data?.forEach((m: DbSupplierProductMapRow) => {
            const keys = [
                m.supplier_sku,
                normalizeItemCode(m.supplier_sku || '').normalized,
                m.supplier_customer_stock_code,
                normalizeItemCode(m.supplier_customer_stock_code || '').normalized
            ].filter(Boolean);
            keys.forEach((key) => {
                if (!globalConsensus[key]) globalConsensus[key] = [];
                globalConsensus[key].push(m.product_id);
            });
        });

        const confirmedMemory = new Map<string, DbSupplierProductMapRow>();
        const confirmedCustomerCodeMemory = new Map<string, DbSupplierProductMapRow>();
        (existingMappingsRes.data || [])
            .filter((m: DbSupplierProductMapRow) => m.mapping_status === 'CONFIRMED')
            .forEach((m: DbSupplierProductMapRow) => {
                if (m.supplier_sku) confirmedMemory.set(m.supplier_sku, m);
                const normalizedCustomerCode = normalizeItemCode(m.supplier_customer_stock_code || '').normalized;
                if (normalizedCustomerCode) confirmedCustomerCodeMemory.set(normalizedCustomerCode, m);
            });

        const manualOverrides = new Set(
            (existingMappingsRes.data || [])
                .filter((m: DbSupplierProductMapRow) => m.manual_override || m.mapping_status === 'REJECTED')
                .map((m: DbSupplierProductMapRow) => m.supplier_sku)
        );

        const uniqueSkus = new Map<string, DbStockSnapshotRow>();
        snapshots.forEach((s: DbStockSnapshotRow) => {
            if (!manualOverrides.has(s.supplier_sku) && !uniqueSkus.has(s.supplier_sku)) {
                uniqueSkus.set(s.supplier_sku, s);
            }
        });
        
        const updates: Record<string, unknown>[] = [];
        let confirmed = 0;
        let proposed = 0;

        for (const snap of Array.from(uniqueSkus.values())) {
            const exactMemory = confirmedMemory.get(snap.supplier_sku);
            if (exactMemory) continue;

            const customerCodeMemory = confirmedCustomerCodeMemory.get(normalizeItemCode(snap.customer_stock_code || '').normalized);
            if (customerCodeMemory) {
                updates.push({
                    supplier_id: supplierId,
                    product_id: customerCodeMemory.product_id,
                    supplier_sku: snap.supplier_sku,
                    supplier_customer_stock_code: snap.customer_stock_code,
                    mapping_status: 'CONFIRMED',
                    mapping_method: 'MEMORY',
                    confidence_score: 1,
                    mapping_justification: {
                        components: [{ type: 'SUPPLIER_MEMORY', score: 1, detail: 'Matched from confirmed supplier mapping memory' }]
                    },
                    updated_at: new Date().toISOString()
                });
                confirmed++;
                continue;
            }

            let bestMatch: DbItemRow | null = null;
            let bestScore = 0;
            let secondBestScore = 0;
            let bestJustification: unknown = null;

            for (const item of items) {
                const { score, justification } = db.calculateMappingScore(snap, item, globalConsensus);
                if (score > bestScore) {
                    secondBestScore = bestScore;
                    bestScore = score;
                    bestMatch = item;
                    bestJustification = justification;
                } else if (score > secondBestScore) {
                    secondBestScore = score;
                }
            }

            if (bestMatch && bestScore > 0.45) {
                 const margin = bestScore - secondBestScore;
                 const isHighConfidence = bestScore >= 1.2 && margin >= 0.25;
                 const status = isHighConfidence ? 'CONFIRMED' : 'PROPOSED';
                 const confidenceScore = Math.min(1, Number((bestScore / 2.4).toFixed(2)));
                 if (!isHighConfidence && bestJustification && typeof bestJustification === 'object' && 'components' in bestJustification) {
                    (bestJustification as SupplierProductMap['mappingJustification'])?.components.push({
                        type: 'REVIEW_REQUIRED',
                        score: 0,
                        detail: margin < 0.25 ? 'Close alternate match found; admin review required' : 'Below auto-confirm threshold'
                    });
                 }
                 updates.push({
                     supplier_id: supplierId,
                     product_id: bestMatch.id,
                     supplier_sku: snap.supplier_sku,
                     supplier_customer_stock_code: snap.customer_stock_code,
                     mapping_status: status,
                     mapping_method: 'AUTO_V2',
                     confidence_score: confidenceScore,
                     mapping_justification: bestJustification,
                     updated_at: new Date().toISOString()
                 });
                 if (status === 'CONFIRMED') confirmed++; else proposed++;
            }
        }
        
        if (updates.length > 0) {
            const { error } = await supabase.from('supplier_product_map').upsert(updates, { onConflict: 'supplier_id, supplier_sku' });
            if (error) throw error;
        }
        
        return { confirmed, proposed };
    },


    getMappingQueue: async (supplierId?: string): Promise<SupplierProductMap[]> => {
        let query = supabase.from('supplier_product_map')
            .select(`
                *,
                item:items(sku, name),
                supplier:suppliers(name)
            `)
            .in('mapping_status', ['PROPOSED', 'REJECTED']); 
            
        if (supplierId) {
            query = query.eq('supplier_id', supplierId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        return data.map((m: DbSupplierProductMapRow & { item?: { sku: string; name: string }; supplier?: { name: string } }) => ({
            id: m.id,
            supplierId: m.supplier_id,
            supplierName: m.supplier?.name,
            productId: m.product_id,
            productName: m.item?.name,
            internalSku: m.item?.sku,
            supplierSku: m.supplier_sku,
            mappingStatus: m.mapping_status,
            mappingMethod: m.mapping_method,
            confidenceScore: m.confidence_score,
            mappingJustification: m.mapping_justification,
            manualOverride: m.manual_override,
            updatedAt: m.updated_at
        })) as unknown as SupplierProductMap[];
    },

    createDelivery: async (delivery: DeliveryHeader, poId: string): Promise<void> => {
        const { error: headerError } = await supabase.from('deliveries').insert({
            id: delivery.id,
            po_request_id: poId,
            date: delivery.date,
            docket_number: delivery.docketNumber,
            received_by: delivery.receivedBy,
            received_by_id: delivery.receivedById
        });
        
        if (headerError) throw headerError;

        if (delivery.lines.length > 0) {
            const linesToInsert = delivery.lines.map(l => ({
                id: l.id,
                delivery_id: delivery.id,
                po_line_id: l.poLineId,
                quantity: l.quantity,
                invoice_number: l.invoiceNumber,
                is_capitalised: l.isCapitalised
            }));
            
            const { error: linesError } = await supabase.from('delivery_lines').insert(linesToInsert);
            if (linesError) throw linesError;
        }
    },

    updatePOStatus: async (poId: string, status: string): Promise<void> => {
        const { error, count } = await (supabase
            .from('po_requests')
            .update({ status })
            .eq('id', poId) as unknown as DbUpdateResult)
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        if (count === 0) throw new Error('Permission denied or PO not found. You may not have the rights to update this order in its current status.');
    },

    submitDraftPO: async (poId: string, approverName: string): Promise<void> => {
        const { error } = await supabase.rpc('submit_draft_po', {
            p_request_id: poId,
            p_approver_name: approverName,
        });
        if (error) throw error;
    },

    linkConcurRequest: async (poId: string, concurRequestNumber: string): Promise<void> => {
        const trimmedRequestNumber = concurRequestNumber.trim();
        const { error } = await supabase.rpc('link_concur_request_number', {
            p_po_id: poId,
            p_concur_request_number: trimmedRequestNumber
        });
        if (error) throw new Error(error.message || 'Failed to link Concur Request');
    },

    linkConcurPO: async (poId: string, concurPoNumber: string): Promise<void> => {
        const trimmedPoNumber = concurPoNumber.trim();
        const { error } = await supabase.rpc('link_concur_po_number', {
            p_po_id: poId,
            p_concur_po_number: trimmedPoNumber
        });
        if (error) throw new Error(error.message || 'Failed to link Concur PO');
    },

    updatePOLines: async (lines: Partial<POLineItem>[]): Promise<void> => {
        const { error, count } = await (supabase
            .from('po_lines')
            .upsert(lines) as unknown as DbUpdateResult)
            .select('*', { count: 'exact', head: true });
            
        if (error) throw error;
        // For upsert, we expect at least one row if lines is non-empty
        if (lines.length > 0 && (count === null || count < lines.length)) {
             console.warn(`updatePOLines: Expected ${lines.length} rows, but got ${count}. RLS might be blocking some updates.`);
             // We don't throw if at least some succeeded, but we should be aware.
             // Actually, for consistency, if ANY fail, it's a problem.
             if (count === 0) throw new Error('Failed to update line items. Permission denied.');
        }
    },

    updatePOLine: async (id: string, updates: Partial<POLineItem>): Promise<void> => {
        const payload: Record<string, unknown> = {};
        if (updates.quantityOrdered !== undefined) payload.quantity_ordered = updates.quantityOrdered;
        if (updates.unitPrice !== undefined) payload.unit_price = updates.unitPrice;
        if (updates.totalPrice !== undefined) payload.total_price = updates.totalPrice;

        const { error, count } = await (supabase
            .from('po_lines')
            .update(payload)
            .eq('id', id) as unknown as DbUpdateResult)
            .select('*', { count: 'exact', head: true });
            
        if (error) throw error;
        if (count === 0) throw new Error('Failed to update line item. Permission denied.');
    },

    getMigrationMappings: async (): Promise<Record<string, string>> => {
        const { data, error } = await supabase.from('migration_mappings').select('excel_variant, item_id');
        if (error) {
            console.error('Error fetching migration mappings:', error);
            return {};
        }
        
        const SKIP_ITEM_ID = '00000000-0000-0000-0000-000000000000';
        const lookup: Record<string, string> = {};
        data?.forEach((row: { excel_variant: string; item_id: string }) => {
            if (row.excel_variant) {
                const key = row.excel_variant.toLowerCase().trim();
                if (row.item_id === SKIP_ITEM_ID) {
                    lookup[key] = 'SKIP';
                } else if (row.item_id) {
                    lookup[key] = row.item_id;
                }
            }
        });
        return lookup;
    },

    saveMigrationMapping: async (excelVariant: string, itemId: string): Promise<void> => {
        const cleanVariant = excelVariant.trim();
        if (!cleanVariant || !itemId) return;

        const SKIP_ITEM_ID = '00000000-0000-0000-0000-000000000000';
        let finalId = itemId;

        if (itemId === 'SKIP') {
            finalId = SKIP_ITEM_ID;
            await supabase.from('items').upsert({
                id: SKIP_ITEM_ID,
                sku: 'SYSTEM-SKIP',
                name: 'Skipped Item',
                description: 'Placeholder for ignored migration items',
                active_flag: false,
                category: null
            }, { onConflict: 'id', ignoreDuplicates: true });
        }

        const { error } = await supabase.from('migration_mappings').upsert({
            excel_variant: cleanVariant,
            item_id: finalId
        }, { onConflict: 'excel_variant' });
        
        if (error) console.error('Error saving migration mapping:', error);
    },

    deleteMigrationMapping: async (excelVariant: string): Promise<void> => {
        const { error } = await supabase.from('migration_mappings').delete().eq('excel_variant', excelVariant.trim());
        if (error) throw error;
    },

    deleteMapping: async (id: string): Promise<void> => {
        const { error } = await supabase.from('supplier_product_map').delete().eq('id', id);
        if (error) throw error;
    },

    syncItemsFromSnapshots: async (supplierId: string): Promise<{ updated: number }> => {
        const { data: mappings, error: mErr } = await supabase
            .from('supplier_product_map')
            .select('product_id, supplier_sku')
            .eq('supplier_id', supplierId)
            .eq('mapping_status', 'CONFIRMED');
            
        if (mErr) throw mErr;
        if (!mappings || mappings.length === 0) return { updated: 0 };

        const { data: snapshots, error: sErr } = await supabase
            .from('stock_snapshots')
            .select('supplier_sku, sell_price, total_stock_qty, snapshot_date')
            .eq('supplier_id', supplierId)
            .order('snapshot_date', { ascending: false });
            
        if (sErr) throw sErr;
        if (!snapshots || snapshots.length === 0) return { updated: 0 };

        const latestSnaps = snapshots.reduce((acc: Record<string, DbStockSnapshotRow>, curr: DbStockSnapshotRow) => {
            if (!acc[curr.supplier_sku]) {
                acc[curr.supplier_sku] = curr;
            }
            return acc;
        }, {});

        let updatedCount = 0;
        for (const m of mappings) {
            const snap = latestSnaps[m.supplier_sku];
            if (snap && snap.sell_price !== undefined) {
                const { error: uErr } = await supabase
                    .from('items')
                    .update({ 
                        unit_price: snap.sell_price,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', m.product_id);
                
                if (!uErr) updatedCount++;
            }
        }

        return { updated: updatedCount };
    },

    createAuditLog: async (log: Omit<SystemAuditLog, 'id' | 'createdAt'>): Promise<void> => {
        const { error } = await supabase.from('system_audit_logs').insert({
            action_type: log.actionType,
            performed_by: log.performedBy,
            summary: log.summary,
            details: log.details
        });
        if (error) throw error;
    },

    getAuditLogsForRecord: async (recordId: string, relatedIds: string[] = [], tableFilter?: string[]): Promise<SystemAuditLog[]> => {
        const allIds = [recordId, ...relatedIds].filter(Boolean);
        let query = supabase
            .from('system_audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(300);

        if (allIds.length === 1) {
            query = query.filter('summary->>recordId', 'eq', allIds[0]);
        } else if (allIds.length > 1) {
            query = query.in('summary->>recordId', allIds);
        }

        if (tableFilter && tableFilter.length > 0) {
            query = query.in('summary->>table', tableFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        const logs = data || [];
        
        // Resolve performer names manually
        const performerIds = [...new Set(logs.map((l: DbSystemAuditLogRow) => l.performed_by).filter(Boolean))];
        if (performerIds.length > 0) {
            const { data: userData } = await supabase
                .from('users')
                .select('id, auth_user_id, name')
                .or(`id.in.(${performerIds.join(',')}),auth_user_id.in.(${performerIds.join(',')})`);
            
            if (userData) {
                const userMap = new Map();
                userData.forEach((u: DbUserRow) => {
                    if (u.id) userMap.set(u.id, u.name);
                    if (u.auth_user_id) userMap.set(u.auth_user_id, u.name);
                });
                logs.forEach((l: DbSystemAuditLogRow) => {
                    if (l.performed_by && userMap.has(l.performed_by)) {
                        l.performedByName = userMap.get(l.performed_by);
                    }
                });
            }
        }

        return logs.map((l: DbSystemAuditLogRow) => ({
            id: l.id,
            actionType: l.action_type,
            performedBy: l.performed_by,
            performedByName: l.performedByName || 'System',
            summary: l.summary,
            details: l.details,
            createdAt: l.created_at
        }));
    },

    getAuditLogs: async (filters?: { startDate?: string, endDate?: string, userId?: string, actionType?: string }): Promise<SystemAuditLog[]> => {
        let query = supabase
            .from('system_audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

        if (filters?.startDate) {
            query = query.gte('created_at', filters.startDate);
        }
        if (filters?.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            query = query.lte('created_at', end.toISOString());
        }
        if (filters?.userId) {
            query = query.eq('performed_by', filters.userId);
        }
        if (filters?.actionType) {
            query = query.eq('action_type', filters.actionType);
        }

        const { data, error } = await query;
        if (error) throw error;

        const logs = data || [];
        
        // Resolve performer names manually
        const performerIds = [...new Set(logs.map((l: DbSystemAuditLogRow) => l.performed_by).filter(Boolean))];
        if (performerIds.length > 0) {
            const { data: userData } = await supabase
                .from('users')
                .select('id, auth_user_id, name')
                .or(`id.in.(${performerIds.join(',')}),auth_user_id.in.(${performerIds.join(',')})`);
            
            if (userData) {
                const userMap = new Map();
                userData.forEach((u: DbUserRow) => {
                    if (u.id) userMap.set(u.id, u.name);
                    if (u.auth_user_id) userMap.set(u.auth_user_id, u.name);
                });
                logs.forEach((l: DbSystemAuditLogRow) => {
                    if (l.performed_by && userMap.has(l.performed_by)) {
                        l.performedByName = userMap.get(l.performed_by);
                    }
                });
            }
        }

        return logs.map((l: DbSystemAuditLogRow) => ({
            id: l.id,
            actionType: l.action_type,
            performedBy: l.performed_by,
            performedByName: l.performedByName || 'System',
            summary: l.summary,
            details: l.details,
            createdAt: l.created_at
        }));
    }
};
