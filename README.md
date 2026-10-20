# ✈ Airline Simulator

A browser tycoon game: found an airline, buy planes, hire crews, open routes and watch your fleet fly across a 3D globe.

Built with **TypeScript + Vite + Three.js**.

## Run it

```bash
npm install
npm run dev        # play at http://localhost:5173
npm run build      # production build in dist/
```

## How to play

New airlines start with a **guided tutorial** that highlights each button and moves on as you complete each step. Replay it any time from **Settings → Gameplay → Replay tutorial**.


1. **Store** – buy a plane (new = reliable, used = cheap but breaks more).
2. **Crew** – hire pilots and flight attendants. Every plane needs 2 pilots plus 1 attendant per 50 seats.
   Higher-level pilots crash less and fly slightly faster; higher-level attendants board faster and make passengers happier.
   Crew gain XP on every flight, or you can pay to train them.
3. **Airports** – buy landing rights. Click any dot on the globe to inspect it.
4. **Routes** – connect two of your airports and set the ticket price.
5. **Fleet** – put planes on routes, assign crew, fit wifi/seat upgrades, repair worn planes (or let auto-repair do it).
6. **Service** – choose the food & drinks menu for every flight.
7. **Research** – spend research points (earned from flights) to unlock jets, wide-bodies, supersonic, comfort upgrades and efficiency perks.

Worn, old or badly crewed planes have a higher chance of minor faults, emergencies and (rarely) crashes.

**Save files:** you can run up to 12 airlines side by side. The title screen lists them (most recent first); Settings → Save files lets you switch airline, found a new one, export/import, or delete the current one.

**Hub:** pick your headquarters when founding an airline (recommended hubs such as Chicago O'Hare, New York JFK/Newark, Los Angeles and San Francisco are one click away). You can move it later in Settings for a $50K fee plus the new airport's landing rights; the old hub stays yours.

Click your airline badge (top left) or open Settings to rename the airline, change its code, slogan or livery at any time. Settings also has Day/Night/Auto mode and 8 colour themes (blue, teal, green, yellow, orange, red, pink, purple) that work in either mode.

Keyboard: `Space` pause · `1–4` speed · `F B C R A S T L O` open panels · `Esc` close.

## Code layout

```
src/
  main.ts              boot, render loop, wiring
  data/                static game data (airports, planes, amenities, research tree, names)
  game/                simulation: state & saves, economy formulas, sim tick, player actions
  globe/               Three.js globe, procedural halftone Earth texture, plane meshes, shaders
  ui/                  HUD, dock/drawer shell, modals, toasts, onboarding, checklist
  ui/panels/           one file per menu (fleet, store, crew, routes, airports, service, research, finance, settings)
  styles/              CSS split by area, light/dark tokens in base.css
```
