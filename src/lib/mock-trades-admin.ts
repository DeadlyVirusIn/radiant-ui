// Operator-grade trade ledger, settlement queue, and dispute list.

export type AdminTradeStatus = "in_flight" | "settled" | "failed" | "disputed";
export type SettlementStatus = "pending" | "settled" | "failed";

export type AdminTrade = {
  id: string;
  partner: string;
  account: string;
  gave: string;
  got: string;
  status: AdminTradeStatus;
  retries: number;
  openedAt: number;
  closedAt: number | null;
  durationMs: number | null;
  settlement: SettlementStatus;
  lastError?: string;
};

export type Dispute = {
  id: string;
  tradeId: string;
  openedBy: string;
  reason: string;
  status: "open" | "escalated" | "resolved";
  ageH: number;
};

const now = Date.now();
const mins = (n: number) => now - n * 60_000;

export const ADMIN_TRADES: AdminTrade[] = [
  { id: "TRADE-A9F2", partner: "@kira-ex",    account: "fleet-3", gave: "Mewtwo EX",        got: "Charizard EX",   status: "failed",    retries: 3, openedAt: mins(45), closedAt: mins(22), durationMs: 23 * 60_000, settlement: "failed",  lastError: "Settle handshake timeout · retry budget exhausted" },
  { id: "TRADE-B021", partner: "@onyxhunt",   account: "fleet-1", gave: "Pikachu FA",       got: "Eevee FA",        status: "in_flight", retries: 1, openedAt: mins(8),  closedAt: null,     durationMs: null,          settlement: "pending" },
  { id: "TRADE-C188", partner: "@bidsplash",  account: "fleet-2", gave: "Snorlax R",        got: "Gyarados R",      status: "in_flight", retries: 0, openedAt: mins(3),  closedAt: null,     durationMs: null,          settlement: "pending" },
  { id: "TRADE-D442", partner: "@vaultkid",   account: "fleet-3", gave: "Lugia UR",         got: "Ho-Oh UR",        status: "disputed",  retries: 2, openedAt: mins(180), closedAt: mins(120), durationMs: 60 * 60_000, settlement: "settled", lastError: "Counterparty claims wrong card" },
  { id: "TRADE-E707", partner: "@silvermint", account: "fleet-1", gave: "Mew IM",           got: "Celebi IM",       status: "settled",   retries: 0, openedAt: mins(95), closedAt: mins(94), durationMs: 60_000,        settlement: "settled" },
  { id: "TRADE-F310", partner: "@noahsark",   account: "fleet-2", gave: "Rayquaza FA ×2",   got: "Tyranitar EX",    status: "settled",   retries: 0, openedAt: mins(70), closedAt: mins(69), durationMs: 60_000,        settlement: "settled" },
];

export const DISPUTES: Dispute[] = [
  { id: "DSP-09", tradeId: "TRADE-D442", openedBy: "@vaultkid",  reason: "Wrong rarity delivered",       status: "open",      ageH: 2 },
  { id: "DSP-08", tradeId: "TRADE-9011", openedBy: "@redskull",  reason: "Partner unresponsive",          status: "escalated", ageH: 8 },
  { id: "DSP-07", tradeId: "TRADE-7720", openedBy: "@petalcollab",reason: "Card flagged counterfeit",     status: "resolved",  ageH: 26 },
];

export const STATUS_LABEL: Record<AdminTradeStatus, { label: string; tone: "primary" | "success" | "danger" | "warning" }> = {
  in_flight: { label: "In flight", tone: "primary" },
  settled:   { label: "Settled",   tone: "success" },
  failed:    { label: "Failed",    tone: "danger" },
  disputed:  { label: "Disputed",  tone: "warning" },
};
