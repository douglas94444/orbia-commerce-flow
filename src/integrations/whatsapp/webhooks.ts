export interface WhatsAppStatusUpdate {
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipientId?: string;
}

export function parseWhatsAppWebhook(payload: unknown): WhatsAppStatusUpdate[] {
  const body = payload as Record<string, unknown>;
  const entry = (body.entry ?? []) as Array<Record<string, unknown>>;
  const updates: WhatsAppStatusUpdate[] = [];

  for (const e of entry) {
    const changes = (e.changes ?? []) as Array<Record<string, unknown>>;
    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      const statuses = (value?.statuses ?? []) as Array<Record<string, unknown>>;
      for (const s of statuses) {
        const status = String(s.status ?? "");
        if (!["sent", "delivered", "read", "failed"].includes(status)) continue;
        updates.push({
          messageId: String(s.id ?? ""),
          status: status as WhatsAppStatusUpdate["status"],
          recipientId: s.recipient_id ? String(s.recipient_id) : undefined,
        });
      }
    }
  }

  return updates;
}
