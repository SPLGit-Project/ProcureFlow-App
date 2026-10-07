
CREATE OR REPLACE FUNCTION public.insert_item_request_draft(
  p_requestor_id        uuid,
  p_request_type        text,
  p_item_description    text,
  p_business_reason     text,
  p_target_sap          boolean,
  p_target_bundle       boolean,
  p_target_linenhub     boolean,
  p_target_salesforce   boolean,
  p_department          text    DEFAULT NULL,
  p_customer_reference  text    DEFAULT NULL,
  p_contract_reference  text    DEFAULT NULL,
  p_replacement_for_item_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_row item_requests;
BEGIN
  INSERT INTO item_requests (
    requestor_id, request_type, item_description, business_reason,
    target_sap, target_bundle, target_linenhub, target_salesforce,
    department, customer_reference, contract_reference,
    replacement_for_item_id, status
  ) VALUES (
    p_requestor_id,
    p_request_type::item_request_type,
    p_item_description,
    p_business_reason,
    p_target_sap, p_target_bundle, p_target_linenhub, p_target_salesforce,
    p_department, p_customer_reference, p_contract_reference,
    p_replacement_for_item_id,
    'DRAFT'
  )
  RETURNING * INTO new_row;

  RETURN row_to_json(new_row);
END;
$$;

-- Grant execute to the anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.insert_item_request_draft TO anon, authenticated;
;
