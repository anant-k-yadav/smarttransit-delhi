# SmartTransit Delhi — Crowdedness-Aware Journey Planner

**Transport Stack Hackathon 2026 · Problem 2**  
**Live Prototype:** [Open SmartTransit Delhi](https://smarttransit-delhi-1.ai.studio)

SmartTransit Delhi is a browser-based Delhi bus journey planner and historical demand explorer. It helps commuters compare direct and one-transfer bus journeys by scheduled journey time, transfers, and expected historical ticketing demand—without claiming live bus telemetry or actual onboard occupancy.

## Problem

Delhi bus journey planners usually show routes and scheduled timings, but commuters do not know which routes or time windows historically experience higher passenger demand.

Problem 2 asks for a crowdedness-aware journey planner using Delhi transit data. The aim is to help users make more informed and comfortable travel choices.

## Our Solution

SmartTransit Delhi combines Delhi static GTFS data with October 2026 historical e-ticketing data. Users can:

- Search for direct and one-transfer bus journeys.
- Compare journey options using **Balanced**, **Lower Demand**, or **Fewest Transfers** priorities.
- View estimated historical demand for the chosen route, day type, and time window.
- Compare peak and off-peak demand patterns.
- View route maps, stops, transfer points, and schedule-based travel duration.
- Explore demand analytics and transparent data-quality information.

## Key Features

- **Crowdedness-aware routing:** Evaluates direct and one-transfer journeys across 6,862 Delhi bus stops and 2,574 routes.
- **Lower-demand alternatives:** Suggests calmer route or time-window alternatives where available.
- **Peak vs. off-peak comparison:** Demonstrates how historical demand changes between weekday peak and off-peak periods.
- **Interactive route maps:** Uses Leaflet and OpenStreetMap to display GTFS route paths, stops, transfer hubs, and walking connectors.
- **Historical demand analytics:** Shows route demand patterns by weekday/weekend and time slot.
- **Transparent methodology:** Clearly distinguishes matched and unmatched route codes and explains the limitations of historical demand estimates.
- **Mobile-friendly interface:** Designed to work on desktop and phone screens.

## Real Datasets Used

All data is processed into static browser assets. No paid API, backend database, or fabricated live telemetry is used.

| Dataset | Details |
|---|---|
| Delhi Static Bus GTFS | DTC and DIMTS data with 6,862 stops, 2,574 bus routes, 80,357 scheduled trips, and 3,498 simplified route shapes |
| October 2026 E-Ticketing Demand | 2,559,899 valid ticket rows representing 2,753,606 ticketed passengers from 1–31 October 2026 |
| Exact Route Join Coverage | 1,980 exact GTFS-to-ticketing route matches, covering 87.65% of ticketing route codes |
| Unmatched Codes | 279 unmatched ticketing route codes are kept separate and never guessed or force-matched |

## Methodology

### 1. Exact route matching

Ticketing route codes are matched to GTFS `route_short_name` values using case-insensitive exact matching.

No fuzzy matching is used. If a route does not match exactly, it is labelled as unmatched rather than being incorrectly assigned to another route.

### 2. Historical demand estimation

Valid ticketing records are grouped by:

- Matched route
- Day type: weekday or weekend
- Local IST time window

Time windows used:

| Time window | Hours |
|---|---|
| Early Morning | 05:00–07:59 |
| Morning Peak | 08:00–10:59 |
| Midday | 11:00–16:59 |
| Evening Peak | 17:00–20:59 |
| Late Evening | 21:00–04:59 |

Historical average passenger demand is calculated as:

```text
Average Pax/Hour =
Total ticketed passengers in a route-time window
÷ Number of matching dataset days
÷ Number of hours in that time window
```

Very small positive values are displayed as `<0.1 pax/hr`.

### 3. Within-route demand index

Each route receives a historical demand index from 0–100 based on its own busiest time window:

```text
Within-Route Demand Index =
Current Window Average Pax/Hour
÷ Highest Window Average Pax/Hour for the Same Route
× 100
```

The index is labelled as Low, Moderate, High, or Very High demand.

This index is useful for comparing time windows on the **same route**. It should not be used alone to compare absolute passenger load between different routes; absolute `pax/hr` is shown separately.

### 4. Journey estimation

- Route legs are derived from static GTFS stop sequences and scheduled stop-to-stop durations.
- One-transfer journeys include an 8-minute interchange buffer.
- Journey duration is a static schedule estimate, not a live traffic or live arrival prediction.

## Data Truth and Limitations

SmartTransit Delhi is deliberately transparent about what it can and cannot claim.

- Historical ticketing demand is **not** live bus GPS data.
- It is **not** a live bus arrival prediction system.
- It does **not** measure actual onboard occupancy, empty seats, standing passengers, or vehicle capacity.
- Travel duration is based on static GTFS schedules, not real-time traffic.
- The current prototype covers bus routes only; it does not invent metro, fare, or live traffic data.
- Unmatched ticketing codes remain visible as unmatched instead of being estimated through guesswork.

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS
- **Maps:** Leaflet and OpenStreetMap
- **Charts:** Recharts
- **Testing:** Node test runner with `tsx`


No user login, paid API, backend database, Firebase, Google Maps key, or external runtime API key is required.

## Run Locally

### Prerequisites

- Node.js 20 or newer
- npm

### Commands

```bash
npm install
npm run dev
npm run lint
npx tsx --test src/engine/journeyPlanner.test.ts src/engine/gtfsEngine.test.ts
npm run build
```

The local development server runs at:

```text
http://localhost:3000
```



## Testing Performed

- Tested direct and one-transfer journey searches using real Delhi bus stops.
- Verified route maps, historical-demand views, and ranking options.
- Tested the responsive interface on a mobile phone.
- Checked that the prototype clearly distinguishes historical demand from live occupancy or live arrival data.

## Team
This is a joint team project. Both members contributed equally to the project research, data understanding, feature planning, testing, documentation, and final hackathon preparation.

| Team Member | Role |
|---|---|
| **Shri Narayan Tiwari** | Co-Creator — research, feature planning, testing, documentation, demo preparation, and submission coordination |
| **Anant K. Yadav** | Co-Creator — data integration, interface refinement, testing, documentation, demo preparation, and project implementation |

Built for **Transport Stack Hackathon 2026 — Problem 2: Crowdedness-Aware Journey Planner**.
