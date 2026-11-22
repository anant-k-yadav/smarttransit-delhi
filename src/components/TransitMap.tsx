import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import type { GtfsIndex, GtfsJourneyOption, RawGtfsStop } from '../data/gtfsTypes';
import type { DatasetSourceType, JourneyOption, TransitStop } from '../data/types';

interface GtfsMapProps {
  mode: 'gtfs';
  gtfsIndex: GtfsIndex;
  selectedOption: GtfsJourneyOption | null;
}

interface SyntheticMapProps {
  mode: 'synthetic';
  stops: TransitStop[];
  selectedOption: JourneyOption | null;
  sourceType: DatasetSourceType;
}

export type TransitMapProps = GtfsMapProps | SyntheticMapProps;

const DELHI_CENTER: [number, number] = [28.6139, 77.2295];

export function TransitMap(props: TransitMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DELHI_CENTER,
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.stop();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Re-render markers and GTFS/synthetic polylines when selection changes
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    const boundsPoints: L.LatLngExpression[] = [];

    if (props.mode === 'gtfs') {
      const { gtfsIndex, selectedOption } = props;

      if (selectedOption) {
        // Optional short walking connector if boarding/alighting at a nearby bay
        if (
          selectedOption.boardWalkMeters > 0 &&
          selectedOption.originStop.stopId !== selectedOption.boardStop.stopId
        ) {
          L.polyline(
            [
              [selectedOption.originStop.lat, selectedOption.originStop.lon],
              [selectedOption.boardStop.lat, selectedOption.boardStop.lon],
            ],
            { color: '#64748B', weight: 2.5, dashArray: '4, 6', opacity: 0.85 }
          )
            .bindPopup(
              `Walk ~${selectedOption.boardWalkMeters}m to ${selectedOption.boardStop.name}`
            )
            .addTo(layerGroup);
        }

        if (
          selectedOption.alightWalkMeters > 0 &&
          selectedOption.destinationStop.stopId !== selectedOption.alightStop.stopId
        ) {
          L.polyline(
            [
              [selectedOption.alightStop.lat, selectedOption.alightStop.lon],
              [selectedOption.destinationStop.lat, selectedOption.destinationStop.lon],
            ],
            { color: '#64748B', weight: 2.5, dashArray: '4, 6', opacity: 0.85 }
          )
            .bindPopup(
              `Walk ~${selectedOption.alightWalkMeters}m to ${selectedOption.destinationStop.name}`
            )
            .addTo(layerGroup);
        }

        selectedOption.legs.forEach((leg, legIdx) => {
          const legColor = legIdx === 0 ? '#0F766E' : '#2563EB';

          // Subtle full-route context polyline if GTFS shape exists
          if (leg.fullRouteShapePoints.length >= 2) {
            L.polyline(leg.fullRouteShapePoints, {
              color: '#94A3B8',
              weight: 2,
              opacity: 0.35,
              dashArray: '4, 6',
            }).addTo(layerGroup);
          }

          // Active boarded segment polyline
          if (leg.shapePoints.length >= 2) {
            L.polyline(leg.shapePoints, {
              color: legColor,
              weight: 4.5,
              opacity: 0.92,
              dashArray: leg.shapeSource === 'gtfs_shape' ? undefined : '7, 6',
            })
              .bindPopup(
                `<strong>Route ${leg.shortName} (${leg.agencyId})</strong><br/>${leg.description}<br/><span style="color:#64748b;font-size:11px;">${
                  leg.shapeSource === 'gtfs_shape'
                    ? 'GTFS static route shape (simplified)'
                    : 'GTFS ordered stop-to-stop sequence'
                }</span>`
              )
              .addTo(layerGroup);
            leg.shapePoints.forEach((pt) => boundsPoints.push(pt));
          }

          // Intermediate stop markers
          leg.stopIds.forEach((sid, idx) => {
            const stop = gtfsIndex.stopById.get(sid);
            if (!stop) return;
            const isOriginStop =
              legIdx === 0 && idx === 0;
            const isDestStop =
              legIdx === selectedOption.legs.length - 1 && idx === leg.stopIds.length - 1;
            const isTransferStop =
              selectedOption.transfers > 0 &&
              selectedOption.transferStop?.stopId === sid;

            if (isOriginStop || isDestStop || isTransferStop) return;

            const marker = L.circleMarker([stop.lat, stop.lon], {
              radius: 4.5,
              color: '#FFFFFF',
              weight: 1.5,
              fillColor: '#1E293B',
              fillOpacity: 0.9,
            });
            marker.bindPopup(
              `<div>
                <div style="font-weight:600;color:#0f172a;">${stop.name}</div>
                <div style="color:#475569;margin-top:2px;">Intermediate Stop · Route ${leg.shortName}</div>
                <div style="color:#64748b;margin-top:3px;font-size:11px;">GTFS Stop ID ${stop.stopId} (${stop.stopCode})</div>
              </div>`
            );
            marker.addTo(layerGroup);
            boundsPoints.push([stop.lat, stop.lon]);
          });
        });

        // Origin, Transfer, Destination highlight markers rendered last (on top)
        const plotEndpoint = (
          stop: RawGtfsStop,
          role: 'Origin' | 'Transfer' | 'Destination',
          color: string
        ) => {
          const marker = L.circleMarker([stop.lat, stop.lon], {
            radius: role === 'Transfer' ? 7.5 : 8.5,
            color: '#FFFFFF',
            weight: 2.5,
            fillColor: color,
            fillOpacity: 1,
          });
          marker.bindPopup(
            `<div>
              <div style="font-weight:600;color:#0f172a;">${stop.name}</div>
              <div style="color:#475569;margin-top:2px;">${role} Hub · ID ${stop.stopId}</div>
              <div style="color:#64748b;margin-top:3px;font-size:11px;">Official GTFS bus stop coordinate</div>
            </div>`
          );
          marker.addTo(layerGroup);
          boundsPoints.push([stop.lat, stop.lon]);
        };

        plotEndpoint(selectedOption.boardStop, 'Origin', '#0F766E');
        if (selectedOption.transferStop) {
          plotEndpoint(selectedOption.transferStop, 'Transfer', '#D97706');
        }
        plotEndpoint(selectedOption.alightStop, 'Destination', '#DC2626');
      } else {
        // Initial overview: top 40 Delhi bus hubs
        gtfsIndex.topHubStops.forEach((stop) => {
          const degree = gtfsIndex.stopDegree.get(stop.stopId) ?? 0;
          const marker = L.circleMarker([stop.lat, stop.lon], {
            radius: 5.5,
            color: '#FFFFFF',
            weight: 1.5,
            fillColor: '#0F766E',
            fillOpacity: 0.85,
          });
          marker.bindPopup(
            `<div>
              <div style="font-weight:600;color:#0f172a;">${stop.name}</div>
              <div style="color:#475569;margin-top:2px;">Major Delhi Bus Hub · ${degree} routes</div>
              <div style="color:#64748b;margin-top:3px;font-size:11px;">Stop ID ${stop.stopId} (${stop.stopCode})</div>
            </div>`
          );
          marker.addTo(layerGroup);
          boundsPoints.push([stop.lat, stop.lon]);
        });
      }
    } else {
      // Synthetic fallback rendering
      const { stops, selectedOption } = props;
      const stopById = new Map(stops.map((s) => [s.id, s]));
      const activeStopIds = new Set<string>();

      if (selectedOption) {
        selectedOption.corridor.legs.forEach((leg) => {
          leg.stopIds.forEach((id) => activeStopIds.add(id));
          const pathPoints: L.LatLngExpression[] =
            leg.geometryType === 'gps_trace' && leg.coordinates && leg.coordinates.length > 1
              ? leg.coordinates
              : leg.stopIds
                  .map((id) => stopById.get(id))
                  .filter((s): s is TransitStop => Boolean(s))
                  .map((s) => [s.lat, s.lng] as [number, number]);

          if (pathPoints.length >= 2) {
            L.polyline(pathPoints, {
              color: leg.lineColor,
              weight: 4,
              opacity: 0.9,
              dashArray: leg.geometryType === 'gps_trace' ? undefined : '8, 7',
            })
              .bindPopup(
                `<strong>${leg.lineName}</strong><br/>${
                  leg.geometryType === 'gps_trace'
                    ? 'Verified GPS route trace'
                    : 'Schematic straight-line connector (not a GPS trace)'
                }`
              )
              .addTo(layerGroup);

            pathPoints.forEach((pt) => boundsPoints.push(pt));
          }
        });
      }

      stops.forEach((stop) => {
        const isHighlighted = activeStopIds.has(stop.id);
        const isOrigin = selectedOption?.corridor.originStopId === stop.id;
        const isDest = selectedOption?.corridor.destinationStopId === stop.id;

        const fillColor = isOrigin
          ? '#0F766E'
          : isDest
            ? '#DC2626'
            : isHighlighted
              ? '#1E293B'
              : '#64748B';

        const marker = L.circleMarker([stop.lat, stop.lng], {
          radius: isOrigin || isDest ? 8 : isHighlighted ? 6.5 : 5,
          color: '#FFFFFF',
          weight: 2,
          fillColor,
          fillOpacity: isHighlighted || !selectedOption ? 0.95 : 0.45,
        });

        marker.bindPopup(
          `<div>
            <div style="font-weight:600;color:#0f172a;">${stop.name} (${stop.code})</div>
            <div style="color:#475569;margin-top:2px;">${stop.area}</div>
          </div>`
        );

        marker.addTo(layerGroup);
        if (!selectedOption) {
          boundsPoints.push([stop.lat, stop.lng]);
        }
      });
    }

    if (boundsPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(boundsPoints), {
        padding: [36, 36],
        maxZoom: 14,
        animate: false,
      });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 13, { animate: false });
    } else {
      map.setView(DELHI_CENTER, 12, { animate: false });
    }
  }, [props]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (props.mode === 'gtfs') {
      const pts: L.LatLngExpression[] = props.selectedOption
        ? props.selectedOption.legs.flatMap((l) => l.shapePoints)
        : props.gtfsIndex.topHubStops.map((s) => [s.lat, s.lon] as [number, number]);
      if (pts.length >= 2) {
        map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 14, animate: false });
        return;
      }
    } else {
      const pts: L.LatLngExpression[] = props.stops.map((s) => [s.lat, s.lng]);
      if (pts.length >= 2) {
        map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 13, animate: false });
        return;
      }
    }
    map.setView(DELHI_CENTER, 12, { animate: false });
  };

  const subtitle =
    props.mode === 'gtfs'
      ? props.selectedOption
        ? `Showing ${props.selectedOption.title} (${props.selectedOption.stopCount} stops)`
        : `Showing top ${props.gtfsIndex.topHubStops.length} Delhi bus hubs (${props.gtfsIndex.stops.length.toLocaleString()} stops searchable)`
      : props.selectedOption
        ? `Showing ${props.selectedOption.corridor.name}`
        : `Showing ${props.stops.length} reference transit hubs in synthetic fixture`;

  return (
    <section
      aria-labelledby="transit-map-heading"
      className="rounded-xl bg-white border border-slate-200 overflow-hidden flex flex-col"
    >
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="transit-map-heading"
            className="text-base font-display font-semibold text-slate-900"
          >
            Delhi Transit Map
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={handleRecenter}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Reset view</span>
        </button>
      </div>

      <div
        ref={containerRef}
        data-testid="delhi-leaflet-map"
        className="w-full h-[320px] sm:h-[400px] lg:h-[460px] relative"
        role="region"
        aria-label="Interactive OpenStreetMap view of Delhi bus stops and GTFS route geometry"
      />

      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-700" aria-hidden="true" />
            Origin
          </span>
          {props.mode === 'gtfs' && props.selectedOption && props.selectedOption.transfers > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-600" aria-hidden="true" />
              Transfer
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden="true" />
            Destination
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-800" aria-hidden="true" />
            Stop
          </span>
        </div>

        <p className="text-slate-500">
          {props.mode === 'gtfs'
            ? 'GTFS static shapes & stop coordinates via OpenStreetMap (not live bus GPS).'
            : props.sourceType === 'synthetic_sample'
              ? 'Dashed lines are straight-line schematic connectors, not real GPS traces.'
              : 'Dashed lines indicate schematic connectors.'}
        </p>
      </div>
    </section>
  );
}
