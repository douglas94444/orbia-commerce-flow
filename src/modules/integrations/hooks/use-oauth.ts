import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { startNuvemshopOAuth, startShopifyOAuth } from "../oauth.functions";

export function useStartNuvemshopOAuth() {
  return useMutation({
    mutationFn: (clientId: string) => startNuvemshopOAuth({ data: { clientId } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartShopifyOAuth() {
  return useMutation({
    mutationFn: ({ clientId, shop }: { clientId: string; shop: string }) =>
      startShopifyOAuth({ data: { clientId, shop } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
