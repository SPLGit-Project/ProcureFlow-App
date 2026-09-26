-- ==============================================================================
-- Migration: 20260927010000_sync_historical_cancellation_reasons.sql
-- Description: Synchronise cancellation_reason text on historical auto-cancelled
--              requests to match the updated "Stock Reservation Cancelled" standard.
-- ==============================================================================

UPDATE public.po_requests 
SET cancellation_reason = 'Stock reservation cancelled: Concur PO # was not entered within 48 hours of approval. Reserved supplier stock has been released. Stock can be re-reserved when ready.'
WHERE status = 'CANCELLED' AND auto_cancelled_at IS NOT NULL;
