import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";

export function validateMercadoPagoSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string,
): boolean {
  const { mercadoPago } = getServerConfig();
  const secret = mercadoPago.webhookSecret;
  if (!secret || !xSignature) return !secret;

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), v?.trim() ?? ""];
    }),
  );

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  const manifest = `id:${dataId};request-id:${xRequestId ?? ""};ts:${ts};`;
  const computed = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(computed));
  } catch {
    return false;
  }
}
