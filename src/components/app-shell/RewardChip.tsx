import { REWARD_ICON, type RewardKind } from "@/lib/mock-rewards";

export function RewardChip({ kind, label }: { kind: RewardKind; label: string }) {
  const Icon = REWARD_ICON[kind];
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-transparent bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
