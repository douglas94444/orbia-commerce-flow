import { routeInboundMessage } from "../routing/sac-router.server";

export async function ingestInboundEmail(input: {
  clientId: string;
  from: string;
  subject: string;
  body: string;
}): Promise<{ ticketId: string; protocol: string }> {
  const text = `Assunto: ${input.subject}\n\n${input.body}`;
  const result = await routeInboundMessage({
    clientId: input.clientId,
    channel: "email",
    text,
    fromEmail: input.from,
    forceHuman: true,
  });
  return { ticketId: result.ticketId, protocol: result.protocol };
}
