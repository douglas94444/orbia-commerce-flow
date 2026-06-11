const DB_NAME = "orbia-ops-offline";
const DB_VERSION = 1;
const QUEUE_STORE = "action_queue";

export interface OfflineAction {
  id: string;
  type:
    | "confirm_pick"
    | "confirm_receive"
    | "confirm_pack"
    | "start_pack"
    | "complete_pack";
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
    };
  });
}

export async function enqueueOfflineAction(
  type: OfflineAction["type"],
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await openDb();
  const action: OfflineAction = {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).put(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listOfflineActions(): Promise<OfflineAction[]> {
  const db = await openDb();
  const items = await new Promise<OfflineAction[]>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => {
      const all = req.result as OfflineAction[];
      all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function removeOfflineAction(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
