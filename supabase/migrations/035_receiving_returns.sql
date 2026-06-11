-- Receiving: tipo devolução + vínculo return_request

ALTER TABLE public.receiving_appointments
  ADD COLUMN IF NOT EXISTS appointment_type text NOT NULL DEFAULT 'inbound'
    CHECK (appointment_type IN ('inbound', 'return')),
  ADD COLUMN IF NOT EXISTS return_request_id uuid
    REFERENCES public.return_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_receiving_appt_return
  ON public.receiving_appointments(return_request_id)
  WHERE return_request_id IS NOT NULL;
