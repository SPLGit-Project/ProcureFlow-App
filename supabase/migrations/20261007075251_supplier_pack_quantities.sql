-- Held feature: apply with the matching application branch at the approved release.
-- Internal lookups reuse the approved supplier mapping and stock-pool identity.
CREATE OR REPLACE FUNCTION private.order_pack_size(p_item uuid, p_supplier uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = '' AS $$
 WITH supplier AS (SELECT private.stock_supplier_key(name) AS key FROM public.suppliers WHERE id=p_supplier),
 ids AS (SELECT s.id FROM public.suppliers s,supplier t WHERE private.stock_supplier_key(s.name)=t.key),
 mapping AS (
   SELECT m.* FROM public.supplier_product_map m WHERE m.product_id=p_item
   AND m.supplier_id IN(SELECT id FROM ids) AND m.mapping_status='CONFIRMED'
   ORDER BY coalesce(m.manual_override,false) DESC,coalesce(m.match_priority,0) DESC,m.id LIMIT 1
 ), candidates AS (
   SELECT s.*,(private.stock_code(s.supplier_sku)=private.stock_code(m.supplier_sku)) AS exact_sku,
     (private.stock_code(s.product_name)=private.stock_code(i.name)) AS exact_name
   FROM public.stock_snapshots s,mapping m LEFT JOIN public.items i ON i.id=m.product_id
   WHERE s.supplier_id IN(SELECT id FROM ids)
   AND (private.stock_code(s.supplier_sku)=private.stock_code(m.supplier_sku)
     OR private.stock_code(s.customer_stock_code_raw) IN(private.stock_code(m.supplier_sku),private.stock_code(m.supplier_customer_stock_code),private.stock_code(i.sku))
     OR private.stock_code(s.customer_stock_code_norm) IN(private.stock_code(m.supplier_sku),private.stock_code(m.supplier_customer_stock_code),private.stock_code(i.sku)))
 ), sku_filtered AS (
   SELECT * FROM candidates WHERE NOT EXISTS(SELECT 1 FROM candidates WHERE exact_sku) OR exact_sku
 ), filtered AS (
   SELECT * FROM sku_filtered WHERE NOT EXISTS(SELECT 1 FROM sku_filtered WHERE exact_name) OR exact_name
 ), snapshot AS (
   SELECT * FROM filtered ORDER BY snapshot_date DESC NULLS LAST,
     (CASE WHEN (SELECT key FROM supplier) LIKE '%ncc%' THEN stock_type='CUSTOM' ELSE false END) DESC NULLS LAST,id LIMIT 1
 ), peers AS (
   SELECT f.* FROM public.stock_snapshots f,snapshot s,supplier t
   WHERE f.supplier_id IN(SELECT id FROM ids) AND f.snapshot_date=s.snapshot_date
   AND private.stock_code(f.supplier_sku)=private.stock_code(s.supplier_sku)
   AND (NOT s.exact_name OR private.stock_code(f.product_name)=private.stock_code((SELECT name FROM public.items WHERE id=p_item)))
   AND (t.key NOT LIKE '%ncc%' OR coalesce(f.stock_type,'')=coalesce(s.stock_type,''))
 ), pool AS (SELECT * FROM private.stock_pool(p_item,p_supplier))
 SELECT CASE
   WHEN (SELECT count(DISTINCT carton_qty) FROM peers WHERE carton_qty>0)>1 THEN NULL
   WHEN EXISTS(SELECT 1 FROM snapshot) AND (SELECT snapshot_at FROM pool) IS NULL THEN NULL
   WHEN (SELECT carton_qty FROM snapshot)>0 THEN (SELECT carton_qty FROM snapshot)
   WHEN i.upq>1 AND i.upq=trunc(i.upq) AND i.upq<=2147483647 THEN i.upq::integer
   ELSE NULL END
 FROM public.items i WHERE i.id=p_item;
$$;

CREATE OR REPLACE FUNCTION private.assert_order_pack(p_item uuid,p_supplier uuid,p_quantity numeric)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_size integer;
BEGIN
 v_size:=private.order_pack_size(p_item,p_supplier);
 IF v_size IS NULL THEN
   RAISE EXCEPTION 'PACK_SIZE_UNCONFIRMED: Confirm the supplier bale/carton size for item % before saving or submitting.',p_item;
 END IF;
 IF p_quantity IS NULL OR p_quantity<=0 OR p_quantity<>trunc(p_quantity) OR mod(p_quantity,v_size)<>0 THEN
   RAISE EXCEPTION 'PACK_MULTIPLE_REQUIRED: Item % quantity must be a positive whole multiple of % units.',p_item,v_size;
 END IF;
END;
$$;

-- These functions are private trigger-only validators. Definer rights allow internal
-- pack lookups across supplier aliases without widening client read access.
-- Existing table/RPC authorization remains in force; no public callable RPC is added.
CREATE OR REPLACE FUNCTION private.enforce_order_line_pack()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_supplier uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.item_id IS NOT DISTINCT FROM OLD.item_id
   AND NEW.po_request_id IS NOT DISTINCT FROM OLD.po_request_id
   AND NEW.quantity_ordered IS NOT DISTINCT FROM OLD.quantity_ordered THEN
   RETURN NEW;
 END IF;
 SELECT supplier_id INTO STRICT v_supplier FROM public.po_requests WHERE id=NEW.po_request_id FOR SHARE;
 PERFORM private.assert_order_pack(NEW.item_id,v_supplier,NEW.quantity_ordered);
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_request_pack()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_line record;
BEGIN
 IF NEW.supplier_id IS NOT DISTINCT FROM OLD.supplier_id
   AND NOT (NEW.status='PENDING_APPROVAL' AND OLD.status IS DISTINCT FROM 'PENDING_APPROVAL') THEN
   RETURN NEW;
 END IF;
 FOR v_line IN SELECT item_id,quantity_ordered FROM public.po_lines WHERE po_request_id=NEW.id LOOP
   PERFORM private.assert_order_pack(v_line.item_id,NEW.supplier_id,v_line.quantity_ordered);
 END LOOP;
 RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.order_pack_size(uuid,uuid),private.assert_order_pack(uuid,uuid,numeric),
 private.enforce_order_line_pack(),private.enforce_request_pack() FROM PUBLIC,anon,authenticated;

-- AFTER handles INSERT ... ON CONFLICT correctly: unchanged historic upserts
-- run the UPDATE path and remain editable; any invalid new line rolls back.
CREATE TRIGGER enforce_order_line_pack
 AFTER INSERT OR UPDATE OF item_id,po_request_id,quantity_ordered ON public.po_lines
 FOR EACH ROW EXECUTE FUNCTION private.enforce_order_line_pack();
CREATE TRIGGER enforce_request_pack
 BEFORE UPDATE OF supplier_id,status ON public.po_requests
 FOR EACH ROW EXECUTE FUNCTION private.enforce_request_pack();
