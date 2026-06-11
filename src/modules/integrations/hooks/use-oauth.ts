import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  startNuvemshopOAuth,
  startShopifyOAuth,
  startMercadoLivreOAuth,
  startShopeeOAuth,
  startMetaOAuth,
  startMelhorEnvioOAuth,
  startGoogleOAuth,
  startWhatsAppOAuth,
  startAmazonOAuth,
  startTikTokOAuth,
  startInstagramOAuth,
} from "../oauth.functions";

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

export function useStartMercadoLivreOAuth() {
  return useMutation({
    mutationFn: (clientId: string) => startMercadoLivreOAuth({ data: { clientId } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartShopeeOAuth() {
  return useMutation({
    mutationFn: ({ clientId, shopId }: { clientId: string; shopId: string }) =>
      startShopeeOAuth({ data: { clientId, shopId } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartMetaOAuth() {
  return useMutation({
    mutationFn: (clientId: string) => startMetaOAuth({ data: { clientId } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartGoogleOAuth() {
  return useMutation({
    mutationFn: (clientId: string) => startGoogleOAuth({ data: { clientId } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartMelhorEnvioOAuth() {
  return useMutation({
    mutationFn: (clientId: string) => startMelhorEnvioOAuth({ data: { clientId } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartWhatsAppOAuth() {
  return useMutation({
    mutationFn: (clientId: string) => startWhatsAppOAuth({ data: { clientId } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartAmazonOAuth() {
  return useMutation({
    mutationFn: ({ clientId, sellerId }: { clientId: string; sellerId?: string }) =>
      startAmazonOAuth({ data: { clientId, sellerId } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartTikTokOAuth() {
  return useMutation({
    mutationFn: ({ clientId, shopId }: { clientId: string; shopId: string }) =>
      startTikTokOAuth({ data: { clientId, shopId } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartInstagramOAuth() {
  return useMutation({
    mutationFn: ({ clientId, pageId }: { clientId: string; pageId: string }) =>
      startInstagramOAuth({ data: { clientId, pageId } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
