import { type ReactNode } from "react";
import { Section } from "@/components/app-shell/Section";

/**
 * Section-contained, horizontally scrollable table shell.
 * Children should be <thead>…<tbody>… markup (the inner contents of <table>).
 * Frozen min-width preserves the table's column layout on mobile.
 *
 * NOTE: extracted primitive; per the extraction pass scope this primitive is
 * available but not yet migrated into the frozen routes (would touch many
 * tables and risks subtle drift). Reserved for the next batch.
 */
export function OpsSectionTable({
  minWidth,
  children,
}: {
  minWidth: number;
  children: ReactNode;
}) {
  return (
    <Section padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: `${minWidth}px` }}>
          {children}
        </table>
      </div>
    </Section>
  );
}
