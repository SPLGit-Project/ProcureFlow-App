-- Add freight_amount to delivery_lines table
ALTER TABLE delivery_lines ADD COLUMN freight_amount NUMERIC(10, 2) DEFAULT 0;
