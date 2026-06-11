/** Amazon SP-API order ingestion — Fase 4 stub */
export async function normalizeAmazonOrder(_payload: unknown): Promise<null> {
  console.warn("[amazon] Order ingestion not yet implemented — connect SP-API");
  return null;
}

export async function updateAmazonShipmentStatus(
  _orderId: string,
  _status: string,
  _token: string,
): Promise<void> {
  throw new Error("Amazon SP-API shipment update — em desenvolvimento");
}
