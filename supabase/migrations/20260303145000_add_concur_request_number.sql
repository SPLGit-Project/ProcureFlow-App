-- Add concur_request_number to po_requests table
ALTER TABLE po_requests ADD COLUMN IF NOT EXISTS concur_request_number TEXT;
