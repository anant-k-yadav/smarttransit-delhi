SMARTTRANSIT DELHI — PROCESSED GTFS + TICKETING DATA
Transport Stack Hackathon 2026 — Problem 2

FILES
1) smarttransit_core.json
   - Official static GTFS stop catalogue (6,862 stops with valid coordinates)
   - Official GTFS route catalogue (2,574 bus routes)
   - Route-specific adjacent-stop segments (80,859 unique segments)
   - Simplified GTFS shape geometries for map display (3,498 shapes, up to 30 points each)
   - October 2026 ticketing demand summaries joined to GTFS by exact route code (1,980 matches)
   - Unmatched ticketing route codes (279)

2) smarttransit_trips.json
   - 80,357 GTFS trip summaries with route, direction, headsign, first/last stop,
     first departure, last arrival and stop count.
   - This is a trip-level summary, not the complete per-stop timetable.

3) route_match_report.csv
   - Exact route-code matching results for all 2,259 ticketing route codes.

DATA SOURCES
- delhi_buses_static_gtfs_v1.zip (provided GTFS static feed, feed version v32)
- October 2026 Delhi bus e-ticketing dataset, processed separately into
  delhi_ticketing_route_demand.json.

VALIDATION RESULTS
- 2,574 unique GTFS routes; all route_type=3 (bus).
- 6,862 unique stops; all have valid latitude/longitude.
- 80,357 unique trips.
- 2,737,136 stop-time rows.
- 3,498 shapes; 965,607 source shape points, simplified for map rendering.
- All trip rows reference a route.
- All stop-time rows reference an existing trip and stop.
- 80,859 unique route-specific adjacent-stop segments derived from scheduled trips.
- 72 segment aggregates are flagged for review (average duration <= 0 or > 3,600 seconds).
- 1,980 of 2,259 ticketing route codes (87.65%) exactly match GTFS route_short_name.
- 279 ticketing route codes are unmatched. Do not guess/fuzzy-match these.

IMPORTANT LIMITATIONS
- Ticket counts/passenger_count are historical ticketing-demand proxies, NOT measured onboard occupancy or live crowding.
- The ticketing demand index is normalized within each route. It must not be presented as an absolute occupancy value or compared between routes as if it were occupancy.
- GTFS is static scheduled data, not live vehicle positions or real-time arrivals.
- Segment durations are averages calculated from scheduled adjacent-stop times. They are not real-time travel-time predictions.
- The trips file has first/last stop and trip start/end times, not every trip's full stop-by-stop timetable.
- The source archive did not contain fare-specific files. Do not invent fares.
- Shape geometries are downsampled for display, not survey-grade navigation paths.
- Feed service calendar is 2025-01-01 to 2040-01-01; check with the data provider whether this feed version is the correct current version for the hackathon.

HOW TO USE IN GOOGLE AI STUDIO
1. Keep the existing SmartTransit Delhi project and design.
2. Add smarttransit_core.json and smarttransit_trips.json to the project's public/data/ folder.
3. Fetch them as static assets, e.g. fetch('/data/smarttransit_core.json').
   Do not paste the entire JSON into a source-code file.
4. Build a data adapter that maps these files to the app's existing TypeScript types,
   or create new GTFS types if the existing synthetic schema cannot represent them.
5. Use exact route matches only for joining ticketing demand to GTFS routes.
6. Keep unmatched routes visible as unmatched/insufficient data; do not silently discard or guess.
7. Use routeSegments for route graph construction and scheduled segment-duration estimates.
8. Use shape geometries only for map display.
9. Keep syntheticSample.ts only as a clearly labelled development fallback.
10. Label all crowding outputs as historical ticketing-demand indicators, never verified occupancy.

The JSON files are processed outputs. Keep the original source archives and comply with
the dataset-specific licence/terms before redistribution or publication.
