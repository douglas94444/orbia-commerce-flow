-- ============================================================
-- 014_stock_functions.sql
-- Atomic inventory reservation via row-level locks.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reserve_inventory(
  p_client_id uuid,
  p_sku text,
  p_qty integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available integer;
BEGIN
  IF p_qty <= 0 THEN
    RETURN true;
  END IF;

  SELECT units - reserved INTO v_available
  FROM public.inventory
  WHERE client_id = p_client_id AND sku = p_sku
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU % not found for client', p_sku;
  END IF;

  IF v_available < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock for SKU % (available: %, requested: %)', p_sku, v_available, p_qty;
  END IF;

  UPDATE public.inventory
  SET reserved = reserved + p_qty, updated_at = now()
  WHERE client_id = p_client_id AND sku = p_sku;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_inventory(
  p_client_id uuid,
  p_sku text,
  p_qty integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_qty <= 0 THEN
    RETURN true;
  END IF;

  UPDATE public.inventory
  SET reserved = GREATEST(0, reserved - p_qty), updated_at = now()
  WHERE client_id = p_client_id AND sku = p_sku;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU % not found for client', p_sku;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_inventory(
  p_client_id uuid,
  p_sku text,
  p_qty integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_qty <= 0 THEN
    RETURN true;
  END IF;

  UPDATE public.inventory
  SET
    units = GREATEST(0, units - p_qty),
    reserved = GREATEST(0, reserved - p_qty),
    updated_at = now()
  WHERE client_id = p_client_id AND sku = p_sku;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU % not found for client', p_sku;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_inventory(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_inventory(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_inventory(uuid, text, integer) TO service_role;
