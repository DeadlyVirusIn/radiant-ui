import { type ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

/**
 * Standard read-only drawer footer: separator, disabled action row, note.
 * Children are the (disabled) <Button /> elements.
 */
export function OpsDrawerFooter({
  children,
  note,
}: {
  children: ReactNode;
  note: string;
}) {
  return (
    <>
      <Separator />
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">{children}</div>
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </>
  );
}
