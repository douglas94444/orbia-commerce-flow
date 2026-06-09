// Generic webhook processor for Orbia.
// HTTP ingestion uses webhook-processor.server.ts (no auth).
// processWebhookEvent is a staff-only wrapper for manual reprocessing.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  processWebhookEventInternal,
  saveWebhookEvent,
} from "@/modules/billing/webhook-processor.server";

export {
  saveWebhookEvent,
  processWebhookEventInternal,
} from "@/modules/billing/webhook-processor.server";

export function validateHmac(
  payload: string,
  signature: string,
  secret: string,
  algorithm: "sha256" | "sha1" = "sha256",
  encoding: "hex" | "base64" = "hex",
): boolean {
  const expected = createHmac(algorithm, secret).update(payload).digest(encoding);
  try {
    const a = encoding === "hex" ? Buffer.from(signature, "hex") : Buffer.from(signature, "base64");
    const b = encoding === "hex" ? Buffer.from(expected, "hex") : Buffer.from(expected, "base64");
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const processSchema = z.object({ eventId: z.string().uuid() });

export const processWebhookEvent = createServerFn({ method: "POST" })
  .inputValidator(processSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => processWebhookEventInternal(data.eventId));
