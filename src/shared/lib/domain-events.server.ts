// Lightweight in-process event bus for server-side domain events.

type EventHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, EventHandler[]>();

export function onDomainEvent(event: string, handler: EventHandler): void {
  const list = handlers.get(event) ?? [];
  list.push(handler);
  handlers.set(event, list);
}

export async function emitDomainEvent(
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const list = handlers.get(event) ?? [];
  for (const handler of list) {
    await handler(payload);
  }
}
