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

export interface ExpectedItem {
  sku: string;
  qty: number;
}

export interface ReceivingAppointmentRow {
  id: string;
  scheduledAt: string;
  status: string;
  appointmentType: "inbound" | "return";
  expectedItems: ExpectedItem[];
  returnRequestId: string | null;
  notes: string | null;
}

export interface ReceivingSessionContext {
  sessionId: string;
  appointmentId: string | null;
  appointmentType: "inbound" | "return";
  expectedItems: ExpectedItem[];
  confirmedLines: Array<{
    sku: string;
    expectedQty: number;
    receivedQty: number;
    hasDivergence: boolean;
  }>;
}

export interface ReceivingReportRow {
  appointmentId: string;
  sessionId: string | null;
  scheduledAt: string;
  appointmentType: string;
  status: string;
  sku: string;
  expectedQty: number;
  receivedQty: number;
  hasDivergence: boolean;
  operatorId: string | null;
  completedAt: string | null;
}

function parseExpectedItems(raw: unknown): ExpectedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row as { sku?: string; qty?: number };
      return { sku: String(r.sku ?? ""), qty: Number(r.qty ?? 0) };
    })
    .filter((r) => r.sku && r.qty > 0);
}

async function getSessionAppointment(
  sessionId: string,
): Promise<{
  clientId: string;
  appointmentId: string | null;
  appointmentType: "inbound" | "return";
  expectedItems: ExpectedItem[];
}> {
  const { data: session } = await supabaseAdmin
    .from("receiving_sessions")
    .select("client_id, appointment_id, receiving_appointments(expected_items, appointment_type)")
    .eq("id", sessionId)
    .single();

  if (!session) throw new Error("Sessão não encontrada");

  const appt = session.receiving_appointments as {
    expected_items: unknown;
    appointment_type: string;
  } | null;
  return {
    clientId: session.client_id as string,
    appointmentId: (session.appointment_id as string | null) ?? null,
    appointmentType: (appt?.appointment_type as "inbound" | "return") ?? "inbound",
    expectedItems: parseExpectedItems(appt?.expected_items),
  };
}

export async function createReceivingAppointment(
  clientId: string,
  scheduledAt: string,
  expectedItems: ExpectedItem[],
  options?: {
    appointmentType?: "inbound" | "return";
    returnRequestId?: string;
    notes?: string;
  },
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("receiving_appointments")
    .insert({
      client_id: clientId,
      scheduled_at: scheduledAt,
      expected_items: expectedItems,
      appointment_type: options?.appointmentType ?? "inbound",
      return_request_id: options?.returnRequestId ?? null,
      notes: options?.notes ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function createReturnReceivingAppointment(
  clientId: string,
  returnRequestId: string,
): Promise<string> {
  const { data: req } = await supabaseAdmin
    .from("return_requests")
    .select("id, return_items(sku, qty)")
    .eq("id", returnRequestId)
    .eq("client_id", clientId)
    .single();

  if (!req) throw new Error("Devolução não encontrada");

  const items = (req.return_items as Array<{ sku: string; qty: number }> ?? []).map((i) => ({
    sku: i.sku,
    qty: i.qty,
  }));

  return createReceivingAppointment(clientId, new Date().toISOString(), items, {
    appointmentType: "return",
    returnRequestId,
    notes: `Recebimento devolução ${returnRequestId.slice(0, 8)}`,
  });
}

export async function listReceivingAppointments(clientId: string): Promise<ReceivingAppointmentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("receiving_appointments")
    .select("id, scheduled_at, status, expected_items, appointment_type, return_request_id, notes")
    .eq("client_id", clientId)
    .order("scheduled_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    scheduledAt: row.scheduled_at as string,
    status: row.status as string,
    appointmentType: (row.appointment_type as "inbound" | "return") ?? "inbound",
    expectedItems: parseExpectedItems(row.expected_items),
    returnRequestId: (row.return_request_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  }));
}

export async function listOpsReceivingAppointments(clientId: string): Promise<ReceivingAppointmentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("receiving_appointments")
    .select("id, scheduled_at, status, expected_items, appointment_type, return_request_id, notes")
    .eq("client_id", clientId)
    .in("status", ["scheduled", "in_progress"])
    .order("scheduled_at")
    .limit(20);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    scheduledAt: row.scheduled_at as string,
    status: row.status as string,
    appointmentType: (row.appointment_type as "inbound" | "return") ?? "inbound",
    expectedItems: parseExpectedItems(row.expected_items),
    returnRequestId: (row.return_request_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  }));
}

export async function startReceivingSession(
  clientId: string,
  appointmentId: string | null,
  operatorId: string,
): Promise<string> {
  if (appointmentId) {
    const { data: appt } = await supabaseAdmin
      .from("receiving_appointments")
      .select("id, status")
      .eq("id", appointmentId)
      .eq("client_id", clientId)
      .single();

    if (!appt) throw new Error("Agendamento não encontrado");
    if (appt.status === "completed" || appt.status === "cancelled") {
      throw new Error("Agendamento já finalizado");
    }

    await supabaseAdmin
      .from("receiving_appointments")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", appointmentId);
  }

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

export async function getReceivingSessionContext(sessionId: string): Promise<ReceivingSessionContext> {
  const { data: session } = await supabaseAdmin
    .from("receiving_sessions")
    .select(
      "id, appointment_id, receiving_appointments(expected_items, appointment_type)",
    )
    .eq("id", sessionId)
    .single();

  if (!session) throw new Error("Sessão não encontrada");

  const appt = session.receiving_appointments as {
    expected_items: unknown;
    appointment_type: string;
  } | null;

  const { data: lines } = await supabaseAdmin
    .from("receiving_lines")
    .select("sku, expected_qty, received_qty, has_divergence")
    .eq("session_id", sessionId);

  return {
    sessionId: session.id as string,
    appointmentId: (session.appointment_id as string | null) ?? null,
    appointmentType: (appt?.appointment_type as "inbound" | "return") ?? "inbound",
    expectedItems: parseExpectedItems(appt?.expected_items),
    confirmedLines: (lines ?? []).map((l) => ({
      sku: l.sku as string,
      expectedQty: l.expected_qty as number,
      receivedQty: l.received_qty as number,
      hasDivergence: l.has_divergence as boolean,
    })),
  };
}

export async function uploadReceivingPhoto(
  clientId: string,
  sessionId: string,
  sku: string,
  dataUrl: string,
): Promise<string> {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("Formato de imagem inválido");

  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  const path = `${clientId}/receiving/${sessionId}/${sku}.${ext}`;

  const { error } = await supabaseAdmin.storage.from("fulfillment-evidence").upload(path, buffer, {
    contentType: `image/${match[1]}`,
    upsert: true,
  });
  if (error) throw new Error(`Falha no upload: ${error.message}`);

  const { data: urlData } = supabaseAdmin.storage.from("fulfillment-evidence").getPublicUrl(path);
  return urlData.publicUrl;
}

export async function confirmReceivingLine(
  clientId: string,
  sessionId: string,
  line: ReceivingLineInput,
  operatorId: string,
): Promise<void> {
  const { appointmentId, appointmentType, expectedItems } = await getSessionAppointment(sessionId);
  const isReturnReceiving = appointmentType === "return";

  if (appointmentId && expectedItems.length) {
    const allowed = expectedItems.find((i) => i.sku === line.sku);
    if (!allowed) {
      throw new Error(`SKU ${line.sku} não pertence ao agendamento`);
    }
    if (line.expectedQty !== allowed.qty) {
      line.expectedQty = allowed.qty;
    }
  }

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("barcode")
    .eq("client_id", clientId)
    .eq("sku", line.sku)
    .maybeSingle();

  const expectedBarcode = product?.barcode as string | null;
  if (expectedBarcode) {
    if (!line.barcodeScanned) {
      throw new Error(`Barcode obrigatório para SKU ${line.sku}`);
    }
    if (expectedBarcode !== line.barcodeScanned) {
      throw new Error(`Barcode não confere: esperado ${expectedBarcode}`);
    }
  }

  const hasDivergence = line.receivedQty !== line.expectedQty;

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

  // Devoluções: conferência sem movimentar estoque — reintegração só na inspeção.
  if (line.receivedQty > 0 && !isReturnReceiving) {
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
          qty: ((existing?.qty as number | undefined) ?? 0) + line.receivedQty,
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
  const { data: session } = await supabaseAdmin
    .from("receiving_sessions")
    .select("appointment_id, receiving_appointments(appointment_type, return_request_id)")
    .eq("id", sessionId)
    .eq("client_id", clientId)
    .single();

  if (!session) throw new Error("Sessão não encontrada");

  const appt = session.receiving_appointments as {
    appointment_type: string;
    return_request_id: string | null;
  } | null;

  await supabaseAdmin
    .from("receiving_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (session.appointment_id) {
    await supabaseAdmin
      .from("receiving_appointments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", session.appointment_id);
  }

  const returnRequestId = appt?.return_request_id ?? null;
  if (appt?.appointment_type === "return" && returnRequestId) {
    await supabaseAdmin
      .from("return_requests")
      .update({ status: "received", updated_at: new Date().toISOString() })
      .eq("id", returnRequestId);
  }

  await emitDomainEvent("receiving.completed", {
    clientId,
    sessionId,
    returnRequestId: returnRequestId ?? undefined,
  });
}

export async function listReceivingReports(
  clientId: string,
  from?: string,
  to?: string,
): Promise<ReceivingReportRow[]> {
  let query = supabaseAdmin
    .from("receiving_appointments")
    .select(
      "id, scheduled_at, status, appointment_type, receiving_sessions(id, operator_id, completed_at, receiving_lines(sku, expected_qty, received_qty, has_divergence))",
    )
    .eq("client_id", clientId)
    .order("scheduled_at", { ascending: false })
    .limit(100);

  if (from) query = query.gte("scheduled_at", from);
  if (to) query = query.lte("scheduled_at", to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows: ReceivingReportRow[] = [];
  for (const appt of data ?? []) {
    const sessions = (appt.receiving_sessions as Array<{
      id: string;
      operator_id: string | null;
      completed_at: string | null;
      receiving_lines: Array<{
        sku: string;
        expected_qty: number;
        received_qty: number;
        has_divergence: boolean;
      }>;
    }> | null) ?? [];

    if (!sessions.length) {
      rows.push({
        appointmentId: appt.id as string,
        sessionId: null,
        scheduledAt: appt.scheduled_at as string,
        appointmentType: (appt.appointment_type as string) ?? "inbound",
        status: appt.status as string,
        sku: "",
        expectedQty: 0,
        receivedQty: 0,
        hasDivergence: false,
        operatorId: null,
        completedAt: null,
      });
      continue;
    }

    for (const sess of sessions) {
      for (const line of sess.receiving_lines ?? []) {
        rows.push({
          appointmentId: appt.id as string,
          sessionId: sess.id,
          scheduledAt: appt.scheduled_at as string,
          appointmentType: (appt.appointment_type as string) ?? "inbound",
          status: appt.status as string,
          sku: line.sku,
          expectedQty: line.expected_qty,
          receivedQty: line.received_qty,
          hasDivergence: line.has_divergence,
          operatorId: sess.operator_id,
          completedAt: sess.completed_at,
        });
      }
    }
  }

  return rows;
}

export async function exportReceivingReportCsv(
  clientId: string,
  from?: string,
  to?: string,
): Promise<string> {
  const rows = await listReceivingReports(clientId, from, to);
  const header =
    "appointment_id,session_id,scheduled_at,type,status,sku,expected_qty,received_qty,divergence,completed_at\n";
  const body = rows
    .map((r) =>
      [
        r.appointmentId,
        r.sessionId ?? "",
        r.scheduledAt,
        r.appointmentType,
        r.status,
        r.sku,
        r.expectedQty,
        r.receivedQty,
        r.hasDivergence ? "yes" : "no",
        r.completedAt ?? "",
      ].join(","),
    )
    .join("\n");
  return header + body;
}
