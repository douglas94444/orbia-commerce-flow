import { decryptToken, encryptToken } from "@/lib/crypto.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface LoadedCertificate {
  base64: string;
  password: string | null;
  expiresAt: string | null;
}

export function encryptCertPassword(password: string): string {
  return encryptToken(password);
}

export function decryptCertPassword(stored: string | null): string | null {
  if (!stored) return null;
  return decryptToken(stored);
}

/** Extrai validade do certificado A1 (notAfter) via node-forge. */
export async function parsePfxExpiry(
  pfxBuffer: Buffer,
  password: string,
): Promise<string | null> {
  try {
    const forge = await import("node-forge");
    const p12Der = forge.util.createBuffer(pfxBuffer.toString("binary"));
    const p12Asn1 = forge.asn1.fromDer(p12Der.getBytes());
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || undefined);
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = bags[forge.pki.oids.certBag]?.[0];
    const cert = certBag?.cert;
    if (!cert?.validity?.notAfter) return null;
    return cert.validity.notAfter.toISOString();
  } catch {
    return null;
  }
}

export async function loadCertificateForClient(
  clientId: string,
  certPath: string | null,
  certPasswordEncrypted: string | null,
): Promise<LoadedCertificate | null> {
  if (!certPath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("fiscal-certificates")
    .download(certPath);

  if (error || !data) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  const password = decryptCertPassword(certPasswordEncrypted);
  const expiresAt = password ? await parsePfxExpiry(buffer, password) : null;

  return {
    base64: buffer.toString("base64"),
    password,
    expiresAt,
  };
}
