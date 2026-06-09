import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

    const { error } = await supabaseAdmin.storage.from("nfe-xml").upload(path, xml, {
      contentType: "application/xml",
      upsert: true,
    });

    if (error) {
      console.warn("[fiscal] nfe-xml upload failed:", error.message);
      return null;
    }

    const { data } = supabaseAdmin.storage.from("nfe-xml").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn("[fiscal] nfe-xml fetch/upload error:", err);
    return null;
  }
}
