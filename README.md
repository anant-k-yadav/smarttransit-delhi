# SmartTransit Delhi — Crowdedness-Aware Journey Planner

**Transport Stack Hackathon 2026 · Problem 2**

**Live Demo:** [https://smarttransit-delhi-1.ai.studio](https://smarttransit-delhi-1.ai.studio)

SmartTransit Delhi is a browser-local Delhi bus journey planner and historical demand explorer that helps commuters compare direct and 1-transfer DTC/DIMTS bus options by **scheduled travel time, transfers, and expected within-route demand window**—without paid APIs, backends, or fabricated live telemetry.

---

## Problem & Solution

### Problem
Urban bus commuters in Delhi often see scheduled route listings without visibility into when a corridor experiences its heaviest historical passenger load, or which alternative routes and off-peak departure windows carry lower demand.

### Solution
SmartTransit Delhi joins **Delhi's static bus GTFS feed** with **October 2026 historical e-ticketing demand summaries** directly in the browser to provide:
- **Crowdedness-aware bus routing**: Evaluates direct and 1-transfer bus journeys across 6,862 stops and 2,574 routes with `Balanced`, `Lower Demand`, and `Fewest Transfers` ranking priorities.
- **Lower-demand alternatives & off-peak hints**: Surfaces calmer alternative routes on the same corridor and off-peak time-slot suggestions when peak demand is high.
- **Judge Demo (Peak vs. Off-Peak Comparison)**: One-click comparison on a real Delhi corridor (`AIIMS Ring Road → Nehru Place Terminal`) comparing Weekday Morning Peak (`09:00`) against Weekday Midday / Off-Peak (`13:30`).
- **Interactive Leaflet + OpenStreetMap view**: Plots GTFS route polylines, walking transfer/bay connectors, origin/transfer/destination hubs, and expandable intermediate stop lists.
- **Historical Demand Analytics**: Explores peak vs. off-peak and weekday vs. weekend demand patterns, route volume rankings, and unmatched ticketing route codes.
- **Dataset & Methodology Transparency**: Provides downloadable `route_match_report.csv` and `validation_report.json`, explicit segment flags, and data-truth guarantees.

---

## Real Datasets Used

All datasets are pre-processed into static JSON/CSV assets under `public/assets/aistudio/` and executed 100% locally in the browser:

| Dataset | Details |
| :--- | :--- |
| **Delhi Static Bus GTFS (`v32`)** | Source `delhi_buses_static_gtfs_v1.zip` (DTC & DIMTS) · **6,862** stops with valid coordinates · **2,574** bus routes (`1,814` DTC, `760` DIMTS, `routeType = 3`) · **80,357** scheduled trips · **80,859** adjacent segments (`72` flagged for duration review) · **3,498** simplified shapes |
| **October 2026 E-Ticketing Demand** | Source `October-Delhi.csv.zip` (`Asia/Kolkata`) · **2,559,899** valid ticket rows · **2,753,606** ticketed passengers across **22** weekdays and **9** weekend days (`2026-10-01` to `2026-10-31`) · **2,259** ticketing route codes |
| **Exact Route Join Coverage** | **1,980** exact GTFS-to-ticketing route matches (**87.65%** of ticketing routes) · **279** unmatched ticketing codes kept explicitly separate |

---

## Methodology

1. **Exact Route Matching (Zero Fuzzy Guessing)**
   - Ticketing route codes are matched strictly via case-insensitive exact string equality to GTFS `route_short_name`.
   - Unmatched GTFS routes and unmatched ticketing route codes (`279`) are explicitly labeled **Unmatched** and separated from matched analytics.

2. **Day-Type & IST Time-Slot Demand Estimates**
   - Valid e-ticketing records are grouped by matched route, day type (`weekday` vs. `weekend`), and 5 local IST windows:
     - **Early Morning:** `05:00–07:59` (3h)
     - **Morning Peak:** `08:00–10:59` (3h)
     - **Midday:** `11:00–16:59` (6h)
     - **Evening Peak:** `17:00–20:59` (4h)
     - **Late Evening:** `21:00–04:59` (8h)
   - Hourly rate is computed as `sum(ticketed_passengers) / dataset_days_of_type / slot_hours`. Sub-`0.1` positive rates are displayed as `<0.1 pax/hr`.

3. **Within-Route Normalization**
   - For each matched route independently, its **Within-Route Demand Index (`0–100`)** is calculated as:
     $$\text{Within-Route Index} = \frac{\text{Window Avg Pax/Hr}}{\text{Highest Window Avg Pax/Hr for the Same Route}} \times 100$$
   - Indices map to `Low`, `Moderate`, `High`, and `Very high` within-route demand bands.

4. **Schedule-Based Journey Estimation**
   - Segment travel times sum GTFS stop-to-stop scheduled average durations across the boarded route leg, adding an 8-minute interchange buffer for 1-transfer journeys.

---

## Limitations & Data Truth Guarantees

- **Historical demand estimate, not live telemetry:** October 2026 ticketing counts reflect historical boarding demand by route and time window. They do **not** measure real-time bus GPS locations, live arrival times, vehicle capacity, or actual onboard seat/standing occupancy.
- **No cross-route crowding comparison via index:** Because the `0–100` demand index is normalized relative to each route's own peak window, a `100/100` on one route does not mean identical absolute passenger load as `100/100` on another route. Cross-route scale uses `pax/hr` and total October 2026 ticketed passengers.
- **Static schedule estimates only:** Travel durations come from static GTFS timetables (`72` irregular adjacent segments are flagged for review in the UI).
- **Bus-only feed:** All 2,574 GTFS routes are bus routes (`routeType = 3`). No metro routes, fares, or live traffic feeds are invented.

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite 8
- **Styling:** Tailwind CSS v4, Lucide React
- **Maps:** Leaflet + OpenStreetMap raster tiles
- **Charts:** Recharts
- **Testing:** Node built-in test runner via `tsx`

No backend database, user authentication, Firebase, Google Maps, or external API keys are required.

---

## Running Locally

### Prerequisites
- Node.js 20+ and npm

### Setup & Commands

```bash
# Install dependencies
npm install

# Start the development server (http://localhost:3000)
npm run dev

# Type-check
npm run lint

# Run engine & validator unit tests
npx tsx --test src/engine/journeyPlanner.test.ts src/engine/gtfsEngine.test.ts

# Production build
npm run build
```

---

## Team

- **[Team Member 1]** — Role / Contributions *(placeholder)*
- **[Team Member 2]** — Role / Contributions *(placeholder)*
- **[Team Member 3]** — Role / Contributions *(placeholder)*
