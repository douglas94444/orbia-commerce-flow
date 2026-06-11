-- 033_fefo_location_stock.sql
-- Location-level reservation with FEFO (First Expired, First Out)

ALTER TABLE public.inventory_locations
  ADD COLUMN IF NOT EXISTS reserved_qty integer NOT NULL DEFAULT 0
  CHECK (reserved_qty >= 0);

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
  v_remaining integer;
  v_loc RECORD;
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

  v_remaining := p_qty;
  FOR v_loc IN
    SELECT il.id, il.qty - il.reserved_qty AS avail
    FROM public.inventory_locations il
    LEFT JOIN public.product_lots pl ON pl.id = il.lot_id
    LEFT JOIN public.warehouse_locations wl ON wl.id = il.location_id
    WHERE il.client_id = p_client_id
      AND il.sku = p_sku
      AND il.qty > il.reserved_qty
    ORDER BY pl.expires_at ASC NULLS LAST, wl.route_order ASC, il.qty DESC
  LOOP
    EXIT WHEN v_remaining <= 0;
    IF v_loc.avail <= 0 THEN CONTINUE; END IF;

    UPDATE public.inventory_locations
    SET reserved_qty = reserved_qty + LEAST(v_loc.avail, v_remaining),
        updated_at = now()
    WHERE id = v_loc.id;

    v_remaining := v_remaining - LEAST(v_loc.avail, v_remaining);
  END LOOP;

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
DECLARE
  v_remaining integer;
  v_loc RECORD;
  v_take integer;
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

  v_remaining := p_qty;
  FOR v_loc IN
    SELECT il.id, il.reserved_qty
    FROM public.inventory_locations il
    LEFT JOIN public.product_lots pl ON pl.id = il.lot_id
    LEFT JOIN public.warehouse_locations wl ON wl.id = il.location_id
    WHERE il.client_id = p_client_id
      AND il.sku = p_sku
      AND il.reserved_qty > 0
    ORDER BY pl.expires_at ASC NULLS LAST, wl.route_order ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_loc.reserved_qty, v_remaining);

    UPDATE public.inventory_locations
    SET qty = GREATEST(0, qty - v_take),
        reserved_qty = reserved_qty - v_take,
        updated_at = now()
    WHERE id = v_loc.id;

    v_remaining := v_remaining - v_take;
  END LOOP;

  PERFORM public.record_stock_movement(p_client_id, p_sku, 'commit', p_qty, 'order', NULL, NULL, NULL);
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
DECLARE
  v_remaining integer;
  v_loc RECORD;
  v_release integer;
BEGIN
  IF p_qty <= 0 THEN RETURN true; END IF;

  UPDATE public.inventory
  SET reserved = GREATEST(0, reserved - p_qty), updated_at = now()
  WHERE client_id = p_client_id AND sku = p_sku;

  v_remaining := p_qty;
  FOR v_loc IN
    SELECT il.id, il.reserved_qty
    FROM public.inventory_locations il
    WHERE il.client_id = p_client_id
      AND il.sku = p_sku
      AND il.reserved_qty > 0
    ORDER BY il.reserved_qty DESC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_release := LEAST(v_loc.reserved_qty, v_remaining);

    UPDATE public.inventory_locations
    SET reserved_qty = reserved_qty - v_release,
        updated_at = now()
    WHERE id = v_loc.id;

    v_remaining := v_remaining - v_release;
  END LOOP;

  RETURN true;
END;
$$;
