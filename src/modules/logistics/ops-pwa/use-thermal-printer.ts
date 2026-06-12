/**
 * Impressão térmica opcional via WebUSB (Chrome/Edge).
 * Fallback: abrir label_url no navegador para impressão manual.
 */
export async function printLabelViaWebUsb(labelUrl: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    window.open(labelUrl, "_blank");
    return false;
  }

  try {
    const device = await (navigator as Navigator & { usb: USB }).usb.requestDevice({
      filters: [{ classCode: 7 }],
    });
    await device.open();
    if (device.configuration === null) await device.selectConfiguration(1);
    await device.claimInterface(0);
    const endpoint = device.configuration!.interfaces[0].alternate!.endpoints.find(
      (e) => e.direction === "out",
    );
    if (!endpoint) throw new Error("Endpoint de saída não encontrado");

    const res = await fetch(labelUrl);
    const buf = await res.arrayBuffer();
    await device.transferOut(endpoint.endpointNumber, new Uint8Array(buf));
    await device.close();
    return true;
  } catch {
    window.open(labelUrl, "_blank");
    return false;
  }
}
