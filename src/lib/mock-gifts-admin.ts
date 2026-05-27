// Operator-grade gift queue.

export type AdminGiftStatus = "queued" | "sent" | "delivered" | "failed" | "refunded";

export type AdminGift = {
  id: string;
  recipient: string;
  sku: string;
  source: "promo" | "trade-bonus" | "support" | "campaign";
  status: AdminGiftStatus;
  retries: number;
  sentAt: number;
  lastError?: string;
};

const now = Date.now();
const mins = (n: number) => now - n * 60_000;

export const ADMIN_GIFTS: AdminGift[] = [
  { id: "GIFT-B19", recipient: "@cloud_chime",  sku: "PROMO-MEW-22",   source: "promo",       status: "sent",      retries: 0, sentAt: mins(33) },
  { id: "GIFT-B18", recipient: "@onyxhunt",     sku: "BONUS-PIKA-7",   source: "trade-bonus", status: "delivered", retries: 0, sentAt: mins(45) },
  { id: "GIFT-B17", recipient: "@vaultkid",     sku: "CAMPAIGN-EVO-9", source: "campaign",    status: "failed",    retries: 3, sentAt: mins(47), lastError: "Recipient resolution failed (3 of 24)" },
  { id: "GIFT-B16", recipient: "@silvermint",   sku: "SUP-REFUND-1",   source: "support",     status: "refunded",  retries: 1, sentAt: mins(90), lastError: "Refunded — recipient deactivated" },
  { id: "GIFT-B15", recipient: "@noahsark",     sku: "PROMO-RAY-3",    source: "promo",       status: "delivered", retries: 0, sentAt: mins(110) },
  { id: "GIFT-B14", recipient: "@petalcollab",  sku: "CAMPAIGN-EVO-9", source: "campaign",    status: "queued",    retries: 0, sentAt: mins(2) },
];

export const GIFT_STATUS: Record<AdminGiftStatus, { label: string; tone: "primary" | "success" | "danger" | "warning" | "muted" }> = {
  queued:    { label: "Queued",    tone: "muted" },
  sent:      { label: "Sent",      tone: "primary" },
  delivered: { label: "Delivered", tone: "success" },
  failed:    { label: "Failed",    tone: "danger" },
  refunded:  { label: "Refunded",  tone: "warning" },
};
