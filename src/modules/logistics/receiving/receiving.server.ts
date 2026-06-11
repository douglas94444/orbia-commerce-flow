import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { recordStockMovement } from "./receiving-stock.server";

export interface ReceivingLineInput {
  sku: string;
  expectedQty: number;
  receivedQty: number;
  barcodeScanned?: string;
  locationId?: string;
  photoUrl?: string;
  lotCode?: string;
  expiresAt?: string;
}

export async function createReceivingAppointment(
  clientId: string,
  scheduledAt: string,
  expectedItems: Array<{ sku: string; qty: number }>,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("receiving_appointments")
    .insert({
      client_id: clientId,
      scheduled_at: scheduledAt,
      expected_items: expectedItems,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function startReceivingSession(
  clientId: string,
  appointmentId: string | null,
  operatorId: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("receiving_sessions")
    .insert({
      client_id: clientId,
      appointment_id: appointmentId,
      operator_id: operatorId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function confirmReceivingLine(
  clientId: string,
  sessionId: string,
  line: ReceivingLineInput,
  operatorId: string,
): Promise<void> {
  const hasDivergence = line.receivedQty !== line.expectedQty;

  if (line.barcodeScanned) {
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("barcode")
      .eq("client_id", clientId)
      .eq("sku", line.sku)
      .maybeSingle();

    const expectedBarcode = product?.barcode as string | null;
    if (expectedBarcode && expectedBarcode !== line.barcodeScanned) {
      throw new Error(`Barcode não confere: esperado ${expectedBarcode}`);
    }
  }

  let lotId: string | null = null;
  if (line.lotCode) {
    const { upsertProductLot } = await import("../wms/product-lots.server");
    lotId = await upsertProductLot(clientId, {
      sku: line.sku,
      lotCode: line.lotCode,
      expiresAt: line.expiresAt ?? null,
    });
  }

  await supabaseAdmin.from("receiving_lines").insert({
    session_id: sessionId,
    sku: line.sku,
    expected_qty: line.expectedQty,
    received_qty: line.receivedQty,
    barcode_scanned: line.barcodeScanned ?? null,
    has_divergence: hasDivergence,
    photo_url: line.photoUrl ?? null,
    location_id: line.locationId ?? null,
  });

  if (line.receivedQty > 0) {
    const { data: inv } = await supabaseAdmin
      .from("inventory")
      .select("units")
      .eq("client_id", clientId)
      .eq("sku", line.sku)
      .maybeSingle();

    if (inv) {
      await supabaseAdmin
        .from("inventory")
        .update({ units: (inv.units as number) + line.receivedQty })
        .eq("client_id", clientId)
        .eq("sku", line.sku);
    } else {
      await supabaseAdmin.from("inventory").insert({
        client_id: clientId,
        sku: line.sku,
        product: line.sku,
        units: line.receivedQty,
      });
    }

    if (line.locationId) {
      let existingQuery = supabaseAdmin
        .from("inventory_locations")
        .select("qty")
        .eq("client_id", clientId)
        .eq("sku", line.sku)
        .eq("location_id", line.locationId);

      existingQuery = lotId ? existingQuery.eq("lot_id", lotId) : existingQuery.is("lot_id", null);

      const { data: existing } = await existingQuery.maybeSingle();

      await supabaseAdmin.from("inventory_locations").upsert(
        {
          client_id: clientId,
          sku: line.sku,
          location_id: line.locationId,
          lot_id: lotId,
          qty: (existing?.qty as number | undefined ?? 0) + line.receivedQty,
        },
        { onConflict: "client_id,sku,location_id,lot_id" },
      );
    }

    await recordStockMovement(clientId, line.sku, "entrada", line.receivedQty, sessionId, operatorId);
  }
}

export async function completeReceivingSession(
  clientId: string,
  sessionId: string,
): Promise<void> {
  await supabaseAdmin
    .from("receiving_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  await emitDomainEvent("receiving.completed", { clientId, sessionId });
}
