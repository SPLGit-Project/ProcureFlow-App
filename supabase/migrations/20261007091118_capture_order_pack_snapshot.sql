-- Reuse POLineItem.upq and the configured item UOM, retaining their meaning after reload.
-- Historical rows stay NULL: current supplier data cannot prove a historical pack size.
ALTER TABLE public.po_lines ADD COLUMN upq integer CHECK (upq > 0),
  ADD COLUMN uom text, ADD COLUMN pack_supplier_id uuid REFERENCES public.suppliers(id);

CREATE OR REPLACE FUNCTION private.capture_order_line_pack()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_supplier uuid; v_status text; v_changed boolean; v_unplanned boolean;
BEGIN
  IF TG_OP='UPDATE' THEN
    v_changed:=NEW.item_id IS DISTINCT FROM OLD.item_id
      OR NEW.po_request_id IS DISTINCT FROM OLD.po_request_id
      OR NEW.quantity_ordered IS DISTINCT FROM OLD.quantity_ordered
      OR NEW.upq IS DISTINCT FROM OLD.upq OR NEW.uom IS DISTINCT FROM OLD.uom
      OR NEW.pack_supplier_id IS DISTINCT FROM OLD.pack_supplier_id;
    IF NOT v_changed THEN RETURN NEW; END IF;
  END IF;
  SELECT supplier_id,status INTO STRICT v_supplier,v_status FROM public.po_requests WHERE id=NEW.po_request_id FOR SHARE;
  v_unplanned:=(TG_OP='INSERT' OR OLD.quantity_ordered=0) AND NEW.quantity_ordered=0
    AND NEW.quantity_received>0 AND NEW.total_price=0 AND v_status='VARIANCE_PENDING';
  NEW.upq:=CASE WHEN v_unplanned THEN NULL ELSE private.order_pack_size(NEW.item_id,v_supplier) END;
  SELECT uom INTO NEW.uom FROM public.items WHERE id=NEW.item_id;
  NEW.pack_supplier_id:=v_supplier;
  -- INSERT validation remains AFTER, preserving unchanged historical ON CONFLICT upserts.
  IF TG_OP='UPDATE' AND NOT v_unplanned THEN PERFORM private.assert_order_pack(NEW.item_id,v_supplier,NEW.quantity_ordered); END IF;
  RETURN NEW;
END;
$$;

-- The existing receiving workflow records an unplanned delivery as ordered=0,
-- received>0, ordered total=0 after entering VARIANCE_PENDING. It is not a new order.
CREATE OR REPLACE FUNCTION private.enforce_order_line_pack()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_supplier uuid; v_status text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.item_id IS NOT DISTINCT FROM OLD.item_id
   AND NEW.po_request_id IS NOT DISTINCT FROM OLD.po_request_id
   AND NEW.quantity_ordered IS NOT DISTINCT FROM OLD.quantity_ordered THEN RETURN NEW; END IF;
 SELECT supplier_id,status INTO STRICT v_supplier,v_status FROM public.po_requests WHERE id=NEW.po_request_id FOR SHARE;
 IF (TG_OP='INSERT' OR OLD.quantity_ordered=0) AND NEW.quantity_ordered=0
   AND NEW.quantity_received>0 AND NEW.total_price=0 AND v_status='VARIANCE_PENDING' THEN RETURN NEW; END IF;
 PERFORM private.assert_order_pack(NEW.item_id,v_supplier,NEW.quantity_ordered);
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_request_pack_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
    OR (NEW.status='PENDING_APPROVAL' AND OLD.status IS DISTINCT FROM 'PENDING_APPROVAL') THEN
    UPDATE public.po_lines l SET upq=private.order_pack_size(l.item_id,NEW.supplier_id),
      uom=i.uom, pack_supplier_id=NEW.supplier_id
    FROM public.items i WHERE l.po_request_id=NEW.id AND i.id=l.item_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.capture_order_line_pack(),private.refresh_request_pack_snapshot()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_order_line_pack BEFORE INSERT OR UPDATE ON public.po_lines
  FOR EACH ROW EXECUTE FUNCTION private.capture_order_line_pack();
CREATE TRIGGER refresh_request_pack_snapshot AFTER UPDATE OF supplier_id,status ON public.po_requests
  FOR EACH ROW EXECUTE FUNCTION private.refresh_request_pack_snapshot();
