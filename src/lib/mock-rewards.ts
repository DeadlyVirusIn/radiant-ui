// Shared reward primitives used across Missions, Presents, Events, Achievements.
import { Hourglass, Package as PackageIcon, Sparkles, Star, Ticket, type LucideIcon } from "lucide-react";

export type RewardKind = "pack" | "hourglass" | "ticket" | "dust" | "card";

export type Reward = {
  kind: RewardKind;
  amount: number;
  label: string;
};

/** Relative weight used only as a tiebreaker for recommendation ranking. */
export const REWARD_WEIGHT: Record<RewardKind, number> = {
  card: 100,
  pack: 80,
  ticket: 60,
  hourglass: 30,
  dust: 10,
};

export const REWARD_ICON: Record<RewardKind, LucideIcon> = {
  pack: PackageIcon,
  hourglass: Hourglass,
  ticket: Ticket,
  dust: Sparkles,
  card: Star,
};
