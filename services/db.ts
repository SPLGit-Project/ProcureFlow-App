import { supabase } from '../lib/supabaseClient';
import { User, PORequest, Supplier, Item, Site, WorkflowStep, NotificationRule, RoleDefinition, SupplierCatalogItem, SupplierStockSnapshot, ApprovalEvent, POLineItem, DeliveryHeader, DeliveryLineItem, SupplierProductMap, ProductAvailability, AppNotification, AttributeOption } from '../types';
import { normalizeItemCode } from '../utils/normalization';

export const db = {
    getRoles: async (): Promise<RoleDefinition[]> => {
        const { data, error } = await supabase.from('roles').select('*');
        if (error) throw error;
        return data.map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            isSystem: r.is_system,
            permissions: r.permissions || []
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

    getUsers: async (): Promise<User[]> => {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        return data.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role_id,
            avatar: u.avatar,
            jobTitle: u.job_title,
            status: u.status,
            createdAt: u.created_at,
            siteIds: u.site_ids || [],
            invitedAt: u.invited_at,
            invitationExpiresAt: u.invitation_expires_at
        }));
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
        
        // Fallback: Try to find in public.users first (case-insensitive)
        const { data } = await supabase
            .from('users')
            .select('id')
            .ilike('email', email)
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
        } else {
            // New user - insert
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
        }
    },

    getSites: async (): Promise<Site[]> => {
        const { data, error } = await supabase.from('sites').select('*');
        if (error) throw error;
        return data.map((s: any) => ({
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
        const { error } = await supabase.from('sites').delete().eq('id', id);
        if (error) throw error;
    },

    getSuppliers: async (): Promise<Supplier[]> => {
        const { data, error } = await supabase.from('suppliers').select('*');
        if (error) throw error;
        return data.map((s: any) => ({
            id: s.id,
            name: s.name,
            contactEmail: s.contact_email,
            keyContact: s.key_contact,
            phone: s.phone,
            address: s.address,
            categories: s.categories || []
        }));
    },

    addSupplier: async (s: Supplier): Promise<void> => {
        const { error } = await supabase.from('suppliers').insert({
            id: s.id,
            name: s.name,
            contact_email: s.contactEmail,
            key_contact: s.keyContact,
            phone: s.phone,
            address: s.address,
            categories: s.categories
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
            categories: s.categories
        }).eq('id', s.id);
        if (error) throw error;
    },

    deleteSupplier: async (id: string): Promise<void> => {
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) throw error;
    },

    getItems: async (): Promise<Item[]> => {
        const { data, error } = await supabase.from('items').select('*');
        if (error) throw error;
        return data.map((i: any) => ({
            id: i.id,
            sku: i.sku,
            name: i.name,
            description: i.description,
            unitPrice: i.unit_price,
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
        }));
    },

    getItemImportConfig: async (): Promise<any> => {
        const { data, error } = await supabase.from('app_config').select('value').eq('key', 'item_import_config').single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = Row not found
        return data?.value || { overwrite_fields: {} };
    },

    updateItemImportConfig: async (config: any): Promise<void> => {
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

    getBranding: async (): Promise<any> => {
        const { data, error } = await supabase.from('app_config').select('value').eq('key', 'branding').single();
        if (error && error.code !== 'PGRST116') throw error;
        return data?.value || null;
    },

    updateBranding: async (branding: any): Promise<void> => {
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
        return data.map((m: any) => ({
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
             updated_at: new Date().toISOString()
        });
        if (error) throw error;
    },

    upsertProductAvailability: async (availabilities: ProductAvailability[]): Promise<void> => {
        if (availabilities.length === 0) return;
        const { error } = await supabase.from('product_availability').upsert(availabilities.map(a => ({
             id: a.id,
             product_id: a.productId,
             supplier_id: a.supplierId,
             available_units: a.availableUnits,
             available_order_qty: a.availableOrderQty,
             updated_at: new Date().toISOString()
        })));
        if (error) throw error;
    },

    getProductAvailability: async (): Promise<ProductAvailability[]> => {
        const { data, error } = await supabase.from('product_availability').select('*');
        if (error) throw error;
        return data.map((a: any) => ({
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
        
        const itemUpdates = items.map((i: any) => {
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

        const snapUpdates = snaps.map((s: any) => {
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
        return data.map((c: any) => ({
            id: c.id,
            itemId: c.item_id,
            supplierId: c.supplier_id,
            supplierSku: c.supplier_sku,
            price: c.price
        }));
    },

    getStockSnapshots: async (): Promise<SupplierStockSnapshot[]> => {
        const { data, error } = await supabase.from('stock_snapshots').select('*');
        if (error) throw error;
        return data.map((s: any) => ({
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

    getPOs: async (): Promise<PORequest[]> => {
        const { data, error } = await supabase
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

        if (error) throw error;

        return data.map((p: any) => ({
            id: p.id,
            displayId: p.display_id,
            requestDate: p.request_date,
            requesterId: p.requester_id,
            requesterName: p.requester?.name || 'Unknown',
            site: p.site?.name || 'Unknown Site', 
            supplierId: p.supplier_id,
            supplierName: p.supplier?.name || 'Unknown',
            status: p.status,
            totalAmount: p.total_amount,
            approvalHistory: (p.approvals || []).map((a: any) => ({
                id: a.id,
                action: a.action,
                date: a.date,
                approverName: a.approver_name,
                comments: a.comments
            })),
            lines: (p.lines || []).map((l: any) => ({
                id: l.id,
                itemId: l.item_id,
                itemName: l.item_name,
                sku: l.sku,
                quantityOrdered: l.quantity_ordered,
                quantityReceived: l.quantity_received,
                unitPrice: l.unit_price,
                totalPrice: l.total_price,
                concurPoNumber: l.concur_po_number
            })),
            deliveries: (p.deliveries || []).map((d: any) => ({
                id: d.id,
                date: d.date,
                docketNumber: d.docket_number,
                lines: (d.lines || []).map((dl: any) => ({
                    id: dl.id,
                    poLineId: dl.po_line_id,
                    quantity: dl.quantity,
                    invoiceNumber: dl.invoice_number,
                    isCapitalised: dl.is_capitalised,
                    capitalisedDate: dl.capitalised_date
                }))
            })),
            reasonForRequest: p.reason_for_request,
            customerName: p.customer_name,
            comments: p.comments
        }));
    },

    getWorkflowSteps: async (): Promise<WorkflowStep[]> => {
        const { data, error } = await supabase.from('workflow_steps').select('*').order('order');
        if (error) throw error;
        return data.map((w: any) => ({
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
        return data.map((n: any) => ({
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
        return data.map((n: any) => ({
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
        await supabase.from('user_notifications').update({ is_read: true }).eq('id', id);
    },

    createPO: async (po: PORequest): Promise<string> => {
        // 1. Insert Header
        // Need site_id from name. For now assume po.site is ID or handle carefully.
        // If po.site is "Sydney Warehouse"... we need ID. 
        // But AppContext usually passes ID if selected from dropdown. 
        // Let's rely on it being an ID or UUID.
        
        const { data, error } = await supabase.from('po_requests').insert({
             id: po.id,
             request_date: po.requestDate,
             requester_id: po.requesterId,
             site_id: po.siteId, // Use ID reference (was po.site name)
             supplier_id: po.supplierId,
             status: po.status,
             total_amount: po.totalAmount,
             customer_name: po.customerName,
             reason_for_request: po.reasonForRequest,
             comments: po.comments
        }).select('display_id').single();
        
        if (error) {
            console.error('PO Header Insert Error', error);
            throw error;
        }

        // 2. Insert Lines
        if (po.lines.length > 0) {
            const linesToInsert = po.lines.map(l => ({
                id: l.id,
                po_request_id: po.id,
                item_id: l.itemId,
                sku: l.sku,
                item_name: l.itemName,
                quantity_ordered: l.quantityOrdered,
                quantity_received: l.quantityReceived,
                unit_price: l.unitPrice,
                total_price: l.totalPrice,
                concur_po_number: l.concurPoNumber
            }));
            const { error: lErr } = await supabase.from('po_lines').insert(linesToInsert);
            if (lErr) throw lErr;
        }

        // 3. Insert History 
        if (po.approvalHistory && po.approvalHistory.length > 0) {
             const approval = po.approvalHistory[0];
             await supabase.from('po_approvals').insert({
                 po_request_id: po.id,
                 approver_name: approval.approverName,
                 action: approval.action,
                 date: approval.date,
                 comments: approval.comments
             });
        }
        
        return data?.display_id || po.id;
    },
    

    updatePODetails: async (id: string, details: { clientName?: string, reasonForRequest?: string, comments?: string }): Promise<void> => {
        const { error } = await supabase.from('po_requests').update({
            customer_name: details.clientName,
            reason_for_request: details.reasonForRequest,
            comments: details.comments
        }).eq('id', id);
        if (error) throw error;
    },

    updateDeliveryHeader: async (id: string, updates: { docketNumber?: string, date?: string, receivedBy?: string }): Promise<void> => {
        const payload: any = {};
        if (updates.docketNumber !== undefined) payload.docket_number = updates.docketNumber;
        if (updates.date !== undefined) payload.date = updates.date;
        if (updates.receivedBy !== undefined) payload.received_by = updates.receivedBy;

        const { error } = await supabase.from('deliveries').update(payload).eq('id', id);
        if (error) throw error;
    },

    updateApprovalHistory: async (poId: string, approvalId: string, updates: { approverName?: string, date?: string, comments?: string }): Promise<void> => {
        const payload: any = {};
        if (updates.approverName !== undefined) payload.approver_name = updates.approverName;
        if (updates.date !== undefined) payload.date = updates.date;
        if (updates.comments !== undefined) payload.comments = updates.comments;

        const { error } = await supabase.from('po_approvals').update(payload).eq('id', approvalId).eq('po_request_id', poId);
        if (error) throw error;
    },

    updateDeliveryLineFinanceInfo: async (lineId: string, updates: Partial<DeliveryLineItem>): Promise<void> => {
        const { error } = await supabase.from('delivery_lines').update({
            invoice_number: updates.invoiceNumber,
            is_capitalised: updates.isCapitalised,
            capitalised_date: updates.capitalisedDate
        }).eq('id', lineId);
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
              // Calculate normalization on the fly to ensure consistency
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
                // customer_stock_code: s.customerStockCode, // Removed as column doesn't exist in DB, using raw/norm instead
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
                
                // Normalization
                customer_stock_code_raw: s.customerStockCode || s.supplierSku,
                customer_stock_code_norm: norm.normalized,
                customer_stock_code_alt_norm: norm.alternate
            };
         });

         // SAFE OVERWRITE LOGIC:
         // 1. Delete existing snapshots for this Supplier AND Date
         // This ensures that if the user runs the import 3 times, we don't get 3 sets of data.
         // We only delete for the specific Import Date provided.
         
         const { error: delError } = await supabase
            .from('stock_snapshots')
            .delete()
            .eq('supplier_id', supplierId)
            .eq('snapshot_date', date);
            
         if (delError) {
             console.error('Failed to clear previous stock snapshots', delError);
             throw delError;
         }

         // 2. Insert new rows
         const { error } = await supabase.from('stock_snapshots').insert(rows);
         if (error) throw error;
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

    getItemFieldRegistry: async (): Promise<any[]> => {
        const { data, error } = await supabase.from('item_field_registry').select('*').order('order_index');
        if (error) throw error;
        return data; // Return raw rows for now
    },

    // --- Catalog Management ---

    getAttributeOptions: async (type?: string): Promise<AttributeOption[]> => {
        let query = supabase.from('attribute_options').select('*').eq('active_flag', true);
        if (type) {
            query = query.eq('type', type);
        }
        const { data, error } = await query.order('value');
        if (error) throw error;
        return data.map((o: any) => ({
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
        const { error } = await supabase.from('attribute_options').upsert({
             id: option.id, // Optional, if new
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
        // Soft delete
        const { error } = await supabase.from('attribute_options').update({ active_flag: false }).eq('id', id);
        if (error) throw error;
    },

    // --- Auto-Mapping & Registry ---

    upsertMasterItemsBulk: async (
        inputs: Partial<Item>[], 
        deactivateMissing: boolean = false
    ): Promise<{ created: number, updated: number, deactivated: number }> => {
        
        // 1. Get Config & Existing Items
        const [configRes, itemsRes] = await Promise.all([
            db.getItemImportConfig(),
            supabase.from('items').select('*')
        ]);
        
        if (itemsRes.error) throw itemsRes.error;
        const existingItems = itemsRes.data || [];
        const existingMap = new Map(existingItems.map((i: any) => [i.sap_item_code_norm, i])); // Match on NORM
        
        const overwriteRules = configRes.overwrite_fields || {};
        const timestamp = new Date().toISOString();
        const upsertPayload: any[] = [];
        const processedNorms = new Set<string>();
        
        // Registry Inference
        const fieldKeys = new Set<string>();
        
        // 2. Process Input
        for (const input of inputs) {
            // Collect keys for registry
            Object.keys(input).forEach(k => fieldKeys.add(k));

            if (!input.sku) continue; 
            const norm = normalizeItemCode(input.sku);
            if (!norm.normalized) continue;
            
            processedNorms.add(norm.normalized);
            const existing = existingMap.get(norm.normalized);
            
            const commonFields = {
                sku: input.sku, // Keep key stable
                name: input.name,
                description: input.description,
                unit_price: input.unitPrice,
                uom: input.uom,
                category: input.category,
                sub_category: input.subCategory,
                range_name: input.rangeName,
                stock_type: input.stockType,
                upq: input.upq,
                
                // Extended Fields
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

                // Normalization
                sap_item_code_raw: input.sku,
                sap_item_code_norm: norm.normalized,
                
                updated_at: timestamp,
                active_flag: true
            };

            if (existing) {
                // UPDATE
                upsertPayload.push({
                    id: existing.id,
                    ...commonFields
                });
            } else {
                // INSERT
                upsertPayload.push({
                    ...commonFields,
                    created_at: timestamp
                });
            }
        }
        
        // 3. Update Field Registry
        // We do this optimistically to ensure UI can show these fields
        const registryPayload = Array.from(fieldKeys).map(k => ({
            field_key: k,
            label: k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), // Simple label gen
            data_type: typeof inputs[0][k as keyof Item], // rudimentary type inference
            is_visible: true,
            is_filterable: true
        }));
        // Use UPSERT specific for registry?
        // Using insert with ignore duplicates or upsert on key
        await supabase.from('item_field_registry').upsert(registryPayload, { onConflict: 'field_key' });
        
        // 4. Execute Upsert
        if (upsertPayload.length > 0) {
            const batchSize = 1000;
            for (let i = 0; i < upsertPayload.length; i += batchSize) {
                const batch = upsertPayload.slice(i, i + batchSize);
                const { error } = await supabase.from('items').upsert(batch, { onConflict: 'sap_item_code_norm' });
                if (error) throw error;
            }
        }
        
        let deactivated = 0;
        if (deactivateMissing) {
             const missingIds = existingItems
                .filter((i: any) => i.sap_item_code_norm && !processedNorms.has(i.sap_item_code_norm))
                .map((i: any) => i.id);
                
             if (missingIds.length > 0) {
                 await supabase.from('items').update({ active_flag: false }).in('id', missingIds);
                 deactivated = missingIds.length;
             }
        }
        
        return {
            created: upsertPayload.length - existingItems.length, // Approx (assumes all new are created)
            updated: existingItems.length,
            deactivated
        };
    },

    addItem: async (item: Item): Promise<void> => {
        const norm = normalizeItemCode(item.sku);
        const { error } = await supabase.from('items').insert({
            id: item.id,
            sku: item.sku,
            name: item.name,
            description: item.description,
            unit_price: item.unitPrice,
            uom: item.uom,
            upq: item.upq,
            category: item.category,
            sub_category: item.subCategory,
            stock_level: item.stockLevel,
            supplier_id: item.supplierId || null,
            is_rfid: item.isRfid,
            is_cog: item.isCog,
            
            // Normalize
            sap_item_code_raw: item.sku,
            sap_item_code_norm: norm.normalized,
            
            // Categorization
            range_name: item.rangeName,
            stock_type: item.stockType,
            active_flag: item.activeFlag !== undefined ? item.activeFlag : true,
            created_at: item.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            
            // Extended Attributes
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
            
            specs: item.specs
        });
        if (error) throw error;
    },

    updateItem: async (item: Item): Promise<void> => {
        const norm = normalizeItemCode(item.sku);
        const { error } = await supabase.from('items').update({
            sku: item.sku,
            name: item.name,
            description: item.description,
            unit_price: item.unitPrice,
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
            
            specs: item.specs
        }).eq('id', item.id);
        if (error) throw error;
    },

    deleteItem: async (itemId: string): Promise<void> => {
        const { error } = await supabase.from('items').delete().eq('id', itemId);
        if (error) throw error;
    },

    archiveItem: async (itemId: string): Promise<void> => {
        const { error } = await supabase.from('items').update({ active_flag: false }).eq('id', itemId);
        if (error) throw error;
    },

    runAutoMapping: async (supplierId: string): Promise<{ confirmed: number, proposed: number }> => {
        // 1. Fetch Unmapped Snapshots (latest) & Active Items
        const { data: snapshots } = await supabase.from('stock_snapshots')
            .select('*')
            .eq('supplier_id', supplierId)
            .order('snapshot_date', { ascending: false }); // Todo: limit to distinct SKUs?

        const { data: items } = await supabase.from('items').select('*').eq('active_flag', true);
        
        // [SMART MAPPING] Fetch existing mappings to avoid overwriting decisions
        const { data: existingMappings } = await supabase.from('supplier_product_map')
            .select('supplier_sku, mapping_status')
            .eq('supplier_id', supplierId);

        if (!snapshots || !items) return { confirmed: 0, proposed: 0 };

        // Create a set of SKUs that are already handled (Confirmed or Rejected or Manually Mapped)
        // We only want to auto-map things that are either new OR previously just 'PROPOSED' (and thus not yet actioned)
        // Actually, if it's 'PROPOSED' we might want to re-run to see if we find a better match? 
        // For now, let's say if it is CONFIRMED, REJECTED or MANUAL, we skip.
        // If it is PROPOSED, we can overwrite it with a potentially better match (or same match).
        const handledSkus = new Set(
            (existingMappings || [])
                .filter((m: any) => m.mapping_status === 'CONFIRMED' || m.mapping_status === 'REJECTED')
                .map((m: any) => m.supplier_sku)
        );
        
        // Group snapshots by normalized code to identify distinct products
        const uniqueProducts = new Map<string, any>(); // key -> snapshot
        snapshots.forEach((s: any) => {
             // Skip if we already have a firm decision on this SKU
             if (handledSkus.has(s.supplier_sku)) return;

             if (!uniqueProducts.has(s.customer_stock_code_norm)) {
                 uniqueProducts.set(s.customer_stock_code_norm, s);
             }
        });
        
        const itemMap = new Map();
        const itemAltMap = new Map();
        
        items.forEach((i: any) => {
            if (i.sku) {
                // Calc norm on the fly to ensure consistency with latest logic
                const norm = normalizeItemCode(i.sku);
                
                // Map by normalized
                if (norm.normalized) itemMap.set(norm.normalized, i);
                
                // Map by alternate
                if (norm.alternate) itemAltMap.set(norm.alternate, i);
            }
        });
        
        const updates: any[] = [];
        let confirmed = 0;
        let proposed = 0;

        for (const snap of Array.from(uniqueProducts.values())) {
             // A. Exact Match (Normalized Code)
             const norm = snap.customer_stock_code_norm;
             let match = itemMap.get(norm);
             let method = 'AUTO_NORM';
             
             // A2. Priority Match: Supplier Cust Code == Master SKU
             if (!match && snap.customer_stock_code) {
                 const skuMatch = items.find((i: any) => i.sku && i.sku.toLowerCase().trim() === snap.customer_stock_code.toLowerCase().trim());
                 if (skuMatch) {
                     // RFID Guard: Don't match RFID snap to non-RFID item
                     const snapIsRfid = (snap.product_name + snap.supplier_sku).toLowerCase().includes('rfid');
                     const itemIsRfid = (skuMatch.name + skuMatch.sku).toLowerCase().includes('rfid');
                     
                     if (snapIsRfid === itemIsRfid) {
                        match = skuMatch;
                        method = 'AUTO_SKU_EXACT';
                     }
                 }
             }

             // B. Alt Match (R-Strip)
             if (!match && snap.customer_stock_code_alt_norm) {
                 match = itemAltMap.get(snap.customer_stock_code_alt_norm);
                 method = 'AUTO_ALT';
             }
             
             if (match) {
                 updates.push({
                     supplier_id: supplierId,
                     product_id: match.id,
                     supplier_sku: snap.supplier_sku,
                     supplier_customer_stock_code: snap.customer_stock_code,
                     mapping_status: 'CONFIRMED',
                     mapping_method: method,
                     confidence_score: 1.0
                 });
                 confirmed++;
             } else {
                 // C. Enhanced Fuzzy Match
                 let bestMatch: any = null;
                 let bestScore = 0;
                 
                 const snapName = (snap.product_name || '').toLowerCase();
                 // Tokenizer: Strip 's' at end for simple plural handling
                 const tokenize = (str: string) => str.split(/[\s\-_]+/).map(t => t.replace(/s$/, '')).filter(t => t.length > 2);
                 const snapTokens = tokenize(snapName);
                 const snapIsRfid = snapName.includes('rfid') || snap.supplier_sku.toLowerCase().includes('rfid');
                 
                 if (snapTokens.length > 0) {
                     for (const item of items) {
                         const itemName = (item.name || '').toLowerCase();
                         const itemIsRfid = itemName.includes('rfid') || item.sku.toLowerCase().includes('rfid');
                         
                         // RFID Mismatch Guard
                         if (snapIsRfid !== itemIsRfid) continue;

                         // 1. Direct substring
                         if (itemName === snapName) {
                             bestScore = 1.0;
                             bestMatch = item;
                             break;
                         }
                         
                         // 2. Token Jaccard with Boosts
                         const itemTokens = tokenize(itemName);
                         const intersection = snapTokens.filter((t: string) => itemTokens.includes(t));
                         
                         if (intersection.length > 0) {
                             const union = new Set([...snapTokens, ...itemTokens]);
                             let score = intersection.length / union.size;
                             
                             // Boost for RFID match
                             if (snapIsRfid && itemIsRfid) score += 0.3;
                             
                             // Boost for Customer Code partial match
                             if (snap.customer_stock_code && item.sku.includes(snap.customer_stock_code)) score += 0.2;

                             if (score > bestScore) {
                                 bestScore = score;
                                 bestMatch = item;
                             }
                         }
                     }
                 }

                 if (bestMatch && bestScore > 0.4) { // Threshold for "PROPOSED"
                     updates.push({
                         supplier_id: supplierId,
                         product_id: bestMatch.id,
                         supplier_sku: snap.supplier_sku,
                         supplier_customer_stock_code: snap.customer_stock_code,
                         mapping_status: 'PROPOSED',
                         mapping_method: 'AUTO_FUZZY',
                         confidence_score: bestScore
                     });
                     proposed++;
                 }
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
            .in('mapping_status', ['PROPOSED', 'REJECTED']); // Review queue
            
        if (supplierId) {
            query = query.eq('supplier_id', supplierId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        return data.map((m: any) => ({
            id: m.id,
            supplierId: m.supplier_id,
            supplierName: m.supplier?.name,
            productId: m.item_id,
            productName: m.item?.name,
            internalSku: m.item?.sku,
            supplierSku: m.supplier_sku,
            mappingStatus: m.mapping_status,
            mappingMethod: m.mapping_method,
            confidenceScore: m.confidence_score,
            updatedAt: m.updated_at
        })) as unknown as SupplierProductMap[];
    },

    createDelivery: async (delivery: DeliveryHeader, poId: string): Promise<void> => {
        // 1. Insert Header
        const { error: headerError } = await supabase.from('deliveries').insert({
            id: delivery.id,
            po_request_id: poId,
            date: delivery.date,
            docket_number: delivery.docketNumber,
            received_by: delivery.receivedBy
        });
        
        if (headerError) throw headerError;

        // 2. Insert Lines
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
        const { error } = await supabase.from('po_requests').update({ status }).eq('id', poId);
        if (error) throw error;
    },

    linkConcurPO: async (poLineId: string, concurPoNumber: string): Promise<void> => {
        const { error } = await supabase.from('po_lines').update({ concur_po_number: concurPoNumber }).eq('id', poLineId);
        if (error) throw error;
    },

    getMigrationMappings: async (): Promise<Record<string, string>> => {
        const { data, error } = await supabase.from('migration_mappings').select('excel_variant, item_id');
        if (error) {
            console.error('Error fetching migration mappings:', error);
            return {};
        }
        
        const SKIP_ITEM_ID = '00000000-0000-0000-0000-000000000000';

        // Return lookup: { "excel_code_123": "item_uuid" OR "SKIP" }
        const lookup: Record<string, string> = {};
        data?.forEach((row: any) => {
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
            // Ensure Skip Placeholder Item Exists
            await supabase.from('items').upsert({
                id: SKIP_ITEM_ID,
                sku: 'SYSTEM-SKIP',
                name: 'Skipped Item',
                description: 'Placeholder for ignored migration items',
                active_flag: false,
                category_id: null // Ensure your items table allows null here, or provide valid one. Usually fine.
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
    }
};
