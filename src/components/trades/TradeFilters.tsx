import { Search, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PartnerAggregate } from "@/lib/mock-trades";

export type StatusTab = "all" | "active" | "completed" | "failed" | "cancelled";
export type DirectionFilter = "all" | "incoming" | "outgoing";
export type TimeframeFilter = "24h" | "7d" | "30d" | "all";

export function TradeFilters({
  status,
  onStatusChange,
  direction,
  onDirectionChange,
  partnerId,
  onPartnerChange,
  partners,
  timeframe,
  onTimeframeChange,
  search,
  onSearchChange,
  onReset,
  counts,
  anyActive,
}: {
  status: StatusTab;
  onStatusChange: (s: StatusTab) => void;
  direction: DirectionFilter;
  onDirectionChange: (d: DirectionFilter) => void;
  partnerId: string | "all";
  onPartnerChange: (id: string | "all") => void;
  partners: PartnerAggregate[];
  timeframe: TimeframeFilter;
  onTimeframeChange: (t: TimeframeFilter) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onReset: () => void;
  counts: Record<StatusTab, number>;
  anyActive: boolean;
}) {
  return (
    <div className="space-y-3">
      <Tabs value={status} onValueChange={(v) => onStatusChange(v as StatusTab)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {(["all", "active", "completed", "failed", "cancelled"] as StatusTab[]).map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize gap-1.5">
              {s}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {counts[s]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={direction}
          onValueChange={(v) => v && onDirectionChange(v as DirectionFilter)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="incoming">Incoming</ToggleGroupItem>
          <ToggleGroupItem value="outgoing">Outgoing</ToggleGroupItem>
        </ToggleGroup>

        <Select value={partnerId} onValueChange={(v) => onPartnerChange(v as string | "all")}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Partner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All partners</SelectItem>
            {partners.map((p) => (
              <SelectItem key={p.partner.id} value={p.partner.id}>
                {p.partner.handle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeframe} onValueChange={(v) => onTimeframeChange(v as TimeframeFilter)}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Card, partner, trade ID…"
            className="h-9 pl-8"
          />
        </div>

        {anyActive && (
          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1">
            <X className="h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
