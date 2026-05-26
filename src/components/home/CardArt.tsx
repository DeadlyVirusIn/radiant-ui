import { Star } from "lucide-react";

export type EnergyType =
  | "fire" | "water" | "grass" | "lightning" | "psychic"
  | "fighting" | "dark" | "metal" | "dragon" | "fairy" | "colorless";

export const energy: Record<EnergyType, { from: string; via: string; to: string; glow: string }> = {
  fire:      { from:"from-orange-500/70", via:"via-red-600/40",    to:"to-amber-900/60",   glow:"shadow-[0_8px_40px_-12px_rgba(249,115,22,0.5)]" },
  water:     { from:"from-sky-400/70",    via:"via-blue-600/40",   to:"to-indigo-900/60",  glow:"shadow-[0_8px_40px_-12px_rgba(56,189,248,0.5)]" },
  grass:     { from:"from-emerald-400/70",via:"via-green-600/40",  to:"to-teal-900/60",    glow:"shadow-[0_8px_40px_-12px_rgba(52,211,153,0.5)]" },
  lightning: { from:"from-yellow-300/80", via:"via-amber-500/40",  to:"to-yellow-900/60",  glow:"shadow-[0_8px_40px_-12px_rgba(250,204,21,0.55)]" },
  psychic:   { from:"from-fuchsia-400/70",via:"via-purple-600/40", to:"to-indigo-900/60",  glow:"shadow-[0_8px_40px_-12px_rgba(217,70,239,0.5)]" },
  fighting:  { from:"from-orange-700/70", via:"via-amber-800/40",  to:"to-stone-900/60",   glow:"shadow-[0_8px_40px_-12px_rgba(180,83,9,0.5)]" },
  dark:      { from:"from-slate-600/70",  via:"via-zinc-800/40",   to:"to-black/70",       glow:"shadow-[0_8px_40px_-12px_rgba(15,23,42,0.7)]" },
  metal:     { from:"from-slate-300/70",  via:"via-zinc-500/40",   to:"to-slate-800/60",   glow:"shadow-[0_8px_40px_-12px_rgba(148,163,184,0.5)]" },
  dragon:    { from:"from-amber-400/70",  via:"via-indigo-600/40", to:"to-violet-900/60",  glow:"shadow-[0_8px_40px_-12px_rgba(251,191,36,0.45)]" },
  fairy:     { from:"from-pink-300/70",   via:"via-rose-500/40",   to:"to-fuchsia-900/60", glow:"shadow-[0_8px_40px_-12px_rgba(244,114,182,0.5)]" },
  colorless: { from:"from-slate-200/60",  via:"via-slate-400/30",  to:"to-slate-700/60",   glow:"shadow-[0_8px_40px_-12px_rgba(203,213,225,0.4)]" },
};

export const rarityRing: Record<string, string> = {
  Crown: "ring-2 ring-yellow-400/80",
  Immersive: "ring-2 ring-fuchsia-400/70",
  Star: "ring-2 ring-amber-300/60",
  "Full Art": "ring-1 ring-sky-300/70",
  EX: "ring-1 ring-orange-400/70",
};

export function CardArt({ name, type, rarity, set, className = "" }: {
  name: string; type: EnergyType; rarity?: keyof typeof rarityRing; set?: string; className?: string;
}) {
  const e = energy[type];
  const ring = rarity ? rarityRing[rarity] ?? "" : "";
  return (
    <div className={`relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10 ${ring} ${e.glow} ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${e.from} ${e.via} ${e.to}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.18)_50%,transparent_70%)]" />
      <div className="absolute inset-0 opacity-30 mix-blend-overlay [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0_1px,transparent_1px_4px)]" />
      <div className="absolute inset-x-0 top-1/2 mx-auto h-2/3 w-2/3 -translate-y-1/2 rounded-full border border-white/10 bg-white/5" />
      <div className="absolute inset-x-0 top-1/2 mx-auto h-px w-2/3 -translate-y-1/2 bg-white/20" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-background/40" />
      {rarity && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
          <Star className="h-2.5 w-2.5" /> {rarity}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="truncate font-display text-[11px] font-bold leading-tight text-white drop-shadow">{name}</p>
        {set && <p className="truncate text-[9px] uppercase tracking-wider text-white/70">{set}</p>}
      </div>
    </div>
  );
}
