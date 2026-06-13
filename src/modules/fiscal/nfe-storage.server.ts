import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "nfe-xml";
const SIGNED_URL_TTL_SEC = 3600;

export async function uploadNfeXmlToStorage(
  clientId: string,
  ref: string,
  xmlUrl: string,
): Promise<string | null> {
  if (!xmlUrl) return null;

  try {
    const res = await fetch(xmlUrl);
    if (!res.ok) return null;
    const xml = await res.text();
    const path = `${clientId}/${ref}.xml`;

    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, xml, {
      contentType: "application/xml",
      upsert: true,
    });

    if (error) {
      console.warn("[fiscal] nfe-xml upload failed:", error.message);
      return null;
    }

    return path;
  } catch (err) {
    console.warn("[fiscal] nfe-xml fetch/upload error:", err);
    return null;
  }
}

export async function createNfeXmlSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath || storagePath.startsWith("http")) return storagePath;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

  if (error) {
    console.warn("[fiscal] signed URL failed:", error.message);
    return null;
  }
  return data.signedUrl;
}

export function isStoragePath(xmlUrl: string | null): boolean {
  return Boolean(xmlUrl && !xmlUrl.startsWith("http"));
}
