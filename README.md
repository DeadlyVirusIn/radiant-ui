# radiant-ui — PackHunter Lovable Redesign Workspace

This repository is the **Lovable redesign workspace** for the PackHunter WebUI. The redesign is built in the **root scaffold** (TanStack Start + React 19 + Tailwind v4 + shadcn/ui + TypeScript).

## Layout
- **`/` (root)** — the live Lovable scaffold. Build the redesigned PackHunter UI here, in TanStack/Tailwind/TS.
- **`reference/packhunter-current/`** — a **read-only snapshot** of the *current* PackHunter WebUI (React 18 + Vite + MUI + JSX). Reference only — do not run, do not port directly.
- **`docs/LOVABLE_INSTRUCTIONS.md`** — how Lovable should use this repo.

## What Lovable should do
Redesign the PackHunter WebUI **in the root scaffold**, using `reference/packhunter-current/` and its docs to understand the existing structure, routes, flows, and UX. Do **not** copy MUI components 1:1 — rebuild them in the root stack. See `docs/LOVABLE_INSTRUCTIONS.md`.

## Important
- The reference snapshot contains **no backend, no secrets, no API keys, no bot/gRPC/DB code** — frontend only.
- Backend logic is out of scope. Use mock data where the UI needs it.
