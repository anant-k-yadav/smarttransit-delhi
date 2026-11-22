import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import type { RawGtfsStop } from '../data/gtfsTypes';

interface StopAutocompleteProps {
  id: string;
  label: string;
  placeholder: string;
  stops: RawGtfsStop[];
  stopDegree: Map<string, number>;
  selectedStopId: string;
  onSelectStop: (stopId: string) => void;
}

export function StopAutocomplete({
  id,
  label,
  placeholder,
  stops,
  stopDegree,
  selectedStopId,
  onSelectStop,
}: StopAutocompleteProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedStop = useMemo(
    () => stops.find((s) => s.stopId === selectedStopId) ?? null,
    [stops, selectedStopId]
  );

  const [query, setQuery] = useState(selectedStop ? selectedStop.name : '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(selectedStop ? selectedStop.name : '');
  }, [selectedStop]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery(selectedStop ? selectedStop.name : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedStop]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    // If input matches the currently selected stop exactly, show top hubs + exact matches so user can switch easily
    const effectiveQ = selectedStop && q === selectedStop.name.toLowerCase() ? '' : q;

    if (!effectiveQ) {
      return [...stops]
        .sort((a, b) => (stopDegree.get(b.stopId) ?? 0) - (stopDegree.get(a.stopId) ?? 0))
        .slice(0, 25);
    }

    const scored: Array<{ stop: RawGtfsStop; rank: number; degree: number }> = [];
    for (const s of stops) {
      const nameLower = s.name.toLowerCase();
      const codeLower = s.stopCode.toLowerCase();
      let rank = -1;
      if (nameLower.startsWith(effectiveQ)) rank = 3;
      else if (nameLower.includes(effectiveQ)) rank = 2;
      else if (codeLower.includes(effectiveQ) || s.stopId === effectiveQ) rank = 1;

      if (rank > 0) {
        scored.push({
          stop: s,
          rank,
          degree: stopDegree.get(s.stopId) ?? 0,
        });
      }
    }

    scored.sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      return b.degree - a.degree;
    });

    return scored.slice(0, 30).map((item) => item.stop);
  }, [query, stops, stopDegree, selectedStop]);

  const commitSelection = (stop: RawGtfsStop) => {
    onSelectStop(stop.stopId);
    setQuery(stop.name);
    setIsOpen(false);
    setActiveIndex(0);
  };

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}
      </label>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          aria-hidden="true"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(e) => {
            if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              setIsOpen(true);
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((prev) => Math.min(matches.length - 1, prev + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((prev) => Math.max(0, prev - 1));
            } else if (e.key === 'Enter' && isOpen && matches[activeIndex]) {
              e.preventDefault();
              commitSelection(matches[activeIndex]);
            } else if (e.key === 'Escape') {
              setIsOpen(false);
              setQuery(selectedStop ? selectedStop.name : '');
            }
          }}
          className="w-full h-11 rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
        />

        {(query || selectedStopId) && (
          <button
            type="button"
            onClick={() => {
              onSelectStop('');
              setQuery('');
              setIsOpen(true);
              setActiveIndex(0);
            }}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3.5 py-3 text-xs text-slate-500">
              No Delhi bus stops matching "{query}". Try landmarks like Kashmere Gate, Anand Vihar, Nehru Place, AIIMS, Azadpur, or Karol Bagh.
            </li>
          ) : (
            matches.map((stop, idx) => {
              const degree = stopDegree.get(stop.stopId) ?? 0;
              const isSelected = stop.stopId === selectedStopId;
              const isHighlighted = idx === activeIndex;
              return (
                <li
                  key={stop.stopId}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitSelection(stop);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`cursor-pointer px-3.5 py-2.5 text-xs transition-colors flex items-start justify-between gap-2 ${
                    isHighlighted
                      ? 'bg-teal-50 text-teal-950'
                      : isSelected
                        ? 'bg-slate-50 text-slate-900'
                        : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin
                      className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                        isHighlighted ? 'text-teal-700' : 'text-slate-400'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{stop.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        ID {stop.stopId} · {stop.stopCode}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                    {degree} {degree === 1 ? 'route' : 'routes'}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
