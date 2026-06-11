export interface SendContext {
  clientId: string;
  customerId: string | null;
  email: string | null;
  phone: string | null;
  storeName: string;
  templateKey: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  metadata: Record<string, unknown>;
  enrollmentContext: Record<string, unknown>;
}

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}
