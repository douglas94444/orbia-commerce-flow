export {
  emitNFe,
  getNFeStatus,
  emitNFeWithRetry,
  cancelNFe,
  emitNFCe,
  emitNFSe,
  emitNFCeWithRetry,
  emitNFSeWithRetry,
  cartaCorrecaoNFe,
  inutilizarNumeracao,
} from "./client";
export type {
  FocusNfePayload,
  FocusNfeItem,
  FocusNfeResponse,
  FocusNfcePayload,
  FocusNfsePayload,
  FocusInutilizacaoPayload,
} from "./client";
