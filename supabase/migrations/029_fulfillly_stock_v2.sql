-- ============================================================
-- 029_fulfillly_stock_v2.sql
-- Stock ledger integration + adjust_stock RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_client_id uuid,
  p_sku text,
  p_movement_type text,
  p_qty integer,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.stock_movements (
    client_id, sku, movement_type, qty, reference_type, reference_id, user_id, reason
  ) VALUES (
    p_client_id, p_sku, p_movement_type, p_qty, p_reference_type, p_reference_id, p_user_id, p_reason
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_client_id uuid,
  p_sku text,
  p_delta integer,
  p_reason text,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movement_id uuid;
  v_adjustment_id uuid;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Justificativa obrigatória para ajuste de estoque';
  END IF;

  UPDATE public.inventory
  SET units = GREATEST(0, units + p_delta), updated_at = now()
  WHERE client_id = p_client_id AND sku = p_sku;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU % not found for client', p_sku;
  END IF;

  v_movement_id := public.record_stock_movement(
    p_client_id, p_sku, 'ajuste', abs(p_delta), 'adjustment', NULL, p_user_id, p_reason
  );

  INSERT INTO public.stock_adjustments (client_id, sku, delta, reason, user_id, movement_id)
  VALUES (p_client_id, p_sku, p_delta, p_reason, p_user_id, v_movement_id)
  RETURNING id INTO v_adjustment_id;

  RETURN v_adjustment_id;
END;
$$;

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
  IF p_qty <= 0 THEN RETURN true; END IF;

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

  PERFORM public.record_stock_movement(p_client_id, p_sku, 'reserva', p_qty, 'order', NULL, NULL, NULL);
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
  IF p_qty <= 0 THEN RETURN true; END IF;

  UPDATE public.inventory
  SET units = GREATEST(0, units - p_qty),
      reserved = GREATEST(0, reserved - p_qty),
      updated_at = now()
  WHERE client_id = p_client_id AND sku = p_sku;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU % not found for client', p_sku;
  END IF;

  PERFORM public.record_stock_movement(p_client_id, p_sku, 'commit', p_qty, 'order', NULL, NULL, NULL);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_stock_movement(uuid, text, text, integer, text, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_stock(uuid, text, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid, text, text, integer, text, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, text, integer, text, uuid) TO service_role;
