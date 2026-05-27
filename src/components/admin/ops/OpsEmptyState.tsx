import { Section } from "@/components/app-shell/Section";

/**
 * Section-contained empty state for operational tables/lists.
 * Mechanical extraction of the px-5 py-10 centered muted message pattern.
 */
export function OpsEmptyState({ message }: { message: string }) {
  return (
    <Section padded={false}>
      <div className="px-5 py-10 text-center text-xs text-muted-foreground">{message}</div>
    </Section>
  );
}
