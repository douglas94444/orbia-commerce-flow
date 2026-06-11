import { useEffect, useState, useCallback } from "react";
import {
  confirmPickLineFn,
  confirmReceivingLineFn,
  confirmPackingItemFn,
} from "../fulfillly.actions.functions";
import {
  enqueueOfflineAction,
  listOfflineActions,
  removeOfflineAction,
  type OfflineAction,
} from "./ops-offline-db";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    const items = await listOfflineActions();
    setPendingCount(items.length);
  }, []);

  const syncQueue = useCallback(async () => {
    const items = await listOfflineActions();
    for (const action of items) {
      try {
        if (action.type === "confirm_pick") {
          await confirmPickLineFn({
            data: action.payload as { taskLineId: string; barcode: string },
          });
        } else if (action.type === "confirm_receive") {
          await confirmReceivingLineFn({ data: action.payload as never });
        } else if (action.type === "confirm_pack") {
          await confirmPackingItemFn({ data: action.payload as never });
        }
        await removeOfflineAction(action.id);
      } catch {
        // keep in queue for next sync
      }
    }
    await refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void syncQueue();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void refreshPending();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [syncQueue, refreshPending]);

  const queueAction = useCallback(
    async (type: OfflineAction["type"], payload: Record<string, unknown>) => {
      if (isOnline) return false;
      await enqueueOfflineAction(type, payload);
      await refreshPending();
      return true;
    },
    [isOnline, refreshPending],
  );

  return { isOnline, pendingCount, queueAction, syncQueue };
}
