import { useEffect, useState, useCallback } from "react";
import {
  confirmPickLineFn,
  markPickLineNotFoundFn,
  confirmReceivingLineFn,
  confirmPackingItemFn,
  startPackingFn,
  completePackingFn,
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
    const sessionMap = new Map<string, string>();

    for (const action of items) {
      try {
        if (action.type === "confirm_pick") {
          await confirmPickLineFn({
            data: action.payload as { taskLineId: string; barcode: string },
          });
        } else if (action.type === "mark_pick_not_found") {
          await markPickLineNotFoundFn({
            data: action.payload as { taskLineId: string },
          });
        } else if (action.type === "confirm_receive") {
          await confirmReceivingLineFn({ data: action.payload as never });
        } else if (action.type === "confirm_pack") {
          await confirmPackingItemFn({ data: action.payload as never });
        } else if (action.type === "start_pack") {
          const localSessionId = String(action.payload.localSessionId ?? "");
          const orderId = String(action.payload.orderId ?? "");
          const started = await startPackingFn({ data: { orderId } });
          const realId =
            typeof started === "object" && started && "sessionId" in started
              ? String(started.sessionId)
              : String(started);
          if (localSessionId && realId) {
            sessionMap.set(localSessionId, realId);
          }
        } else if (action.type === "complete_pack") {
          const rawSessionId = String(action.payload.sessionId ?? "");
          const sessionId = sessionMap.get(rawSessionId) ?? rawSessionId;
          const photoUrls = (action.payload.photoUrls as string[] | undefined) ?? [];
          await completePackingFn({ data: { sessionId, photoUrls } });
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
