/**
 * Shared tone token map for admin ops surfaces.
 * Mechanically extracted — class strings match the inline TONE maps verbatim
 * so pixel/colour parity is preserved across every migrated drawer/table.
 */
export const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};
