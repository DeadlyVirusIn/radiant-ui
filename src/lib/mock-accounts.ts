export type Account = {
  id: string;
  handle: string;
  displayName: string;
  avatarColor: string; // oklch token reference
};

export const ACCOUNTS: Account[] = [
  { id: "acc_01", handle: "bot-01", displayName: "Arden's Hunter", avatarColor: "var(--primary)" },
  { id: "acc_02", handle: "bot-03", displayName: "Kiera's Hunter", avatarColor: "var(--success)" },
  { id: "acc_03", handle: "bot-05", displayName: "Morrow's Hunter", avatarColor: "var(--warning)" },
  { id: "acc_04", handle: "bot-07", displayName: "Nelle's Hunter", avatarColor: "var(--destructive)" },
];

export const DEFAULT_ACCOUNT_ID = ACCOUNTS[0].id;
