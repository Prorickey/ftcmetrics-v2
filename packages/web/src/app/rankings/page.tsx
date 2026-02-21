"use client";

import { useEffect, useState, useMemo, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { rankingsApi } from "@/lib/api";

interface RankedTeam {
  rank: number;
  teamNumber: number;
  epa: number;
  autoEpa: number;
  teleopEpa: number;
  endgameEpa: number;
  matchCount: number;
  trend: "up" | "down" | "stable";
}

interface RankingsData {
  season: number;
  totalTeams: number;
  totalMatches: number;
  eventsProcessed: number;
  lastUpdated: string;
  rankings: RankedTeam[];
}

function getPercentileClasses(rank: number, total: number): string {
  if (total === 0) return "";
  const percentile = rank / total;
  if (percentile <= 0.01) return "bg-blue-500 text-white dark:bg-blue-900/60 dark:text-blue-200";
  if (percentile <= 0.10) return "bg-green-400 text-gray-800 dark:bg-green-900/40 dark:text-green-300";
  if (percentile <= 0.25) return "bg-green-200 text-gray-800 dark:bg-green-900/20 dark:text-green-400";
  if (percentile <= 0.75) return "";
  return "bg-red-200 text-gray-800 dark:bg-red-900/20 dark:text-red-400";
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

interface FiltersData {
  countries: string[];
  states: Record<string, string[]>;
}

type Scope = "global" | "country" | "state";

const LOAD_INCREMENT = 100;

const COUNTRY_DISPLAY_NAMES: Record<string, string> = {
  USA: "United States",
  UK: "United Kingdom",
};

function displayName(value: string, displayMap?: Record<string, string>) {
  return displayMap?.[value] ?? value;
}

function SearchableDropdown({
  options,
  value,
  onSelect,
  placeholder,
  allLabel,
  displayMap,
}: {
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  placeholder: string;
  allLabel?: string;
  displayMap?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = options.filter((opt) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const label = displayMap?.[opt] ?? opt;
    return opt.toLowerCase().includes(s) || label.toLowerCase().includes(s);
  });

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-w-[160px] px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-left flex items-center justify-between gap-2"
      >
        <span className={value ? "" : "text-gray-500 dark:text-gray-400"}>
          {value ? (displayMap?.[value] ?? value) : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search...`}
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {allLabel && (
              <button
                type="button"
                onClick={() => { onSelect(""); setOpen(false); setSearch(""); }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  !value ? "text-ftc-orange font-medium" : ""
                }`}
              >
                {allLabel}
              </button>
            )}
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onSelect(opt); setOpen(false); setSearch(""); }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  value === opt ? "text-ftc-orange font-medium" : ""
                }`}
              >
                {displayMap?.[opt] ?? opt}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                No results found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalRankingsContent() {
  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(LOAD_INCREMENT);

  // Filter state
  const [scope, setScope] = useState<Scope>("global");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [filters, setFilters] = useState<FiltersData | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(false);

  // Fetch filter options on mount
  useEffect(() => {
    async function loadFilters() {
      setFiltersLoading(true);
      try {
        const result = await rankingsApi.getFilters();
        if (result.success && result.data) {
          setFilters(result.data);
        }
      } catch {
        // Filters are optional, don't block the page
      } finally {
        setFiltersLoading(false);
      }
    }
    loadFilters();
  }, []);

  // Fetch rankings whenever scope/country/state changes
  useEffect(() => {
    async function fetchRankings() {
      setLoading(true);
      setError(null);
      try {
        const params: { scope?: string; country?: string; state?: string } = {};
        if (scope !== "global") {
          params.scope = scope;
          if (selectedCountry) params.country = selectedCountry;
          if (scope === "state" && selectedState) params.state = selectedState;
        }
        const result = await rankingsApi.getGlobalEPA(
          scope === "global" ? undefined : params
        );
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error || "Failed to load rankings data.");
        }
      } catch (err) {
        console.error("Failed to fetch global rankings:", err);
        setError("Could not connect to the rankings service. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    // Don't fetch if country scope but no country selected, or state scope but missing params
    if (scope === "country" && !selectedCountry) return;
    if (scope === "state" && (!selectedCountry || !selectedState)) return;

    fetchRankings();
  }, [scope, selectedCountry, selectedState]);

  const matchedTeamNumbers = useMemo(() => {
    if (!data || !teamFilter.trim()) return new Set<number>();
    const matched = new Set<number>();
    data.rankings.forEach((t) => {
      if (String(t.teamNumber).includes(teamFilter.trim())) {
        matched.add(t.teamNumber);
      }
    });
    return matched;
  }, [data, teamFilter]);

  const filteredRankings = useMemo(() => {
    if (!data) return [];
    if (!teamFilter.trim()) return data.rankings;
    const matchedIndices = new Set<number>();
    data.rankings.forEach((t, i) => {
      if (String(t.teamNumber).includes(teamFilter.trim())) {
        for (let j = Math.max(0, i - 5); j <= Math.min(data.rankings.length - 1, i + 5); j++) {
          matchedIndices.add(j);
        }
      }
    });
    return data.rankings.filter((_, i) => matchedIndices.has(i));
  }, [data, teamFilter]);

  const visibleRankings = useMemo(() => {
    return filteredRankings.slice(0, visibleCount);
  }, [filteredRankings, visibleCount]);

  const hasMore = visibleCount < filteredRankings.length;

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(LOAD_INCREMENT);
  }, [teamFilter, scope, selectedCountry, selectedState]);

  // Infinite scroll: auto-load when sentinel enters viewport
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + LOAD_INCREMENT);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Loading state
  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Global Rankings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Season-wide EPA rankings for DECODE 2025-2026
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-ftc-orange border-t-transparent" />
            <div>
              <p className="text-lg font-medium">Loading global rankings...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This may take a moment on first load
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Global Rankings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Season-wide EPA rankings for DECODE 2025-2026
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-red-300 dark:text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Unable to Load Rankings</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {scope === "global" && "Global Rankings"}
          {scope === "country" && selectedCountry && `Rankings for ${selectedCountry}`}
          {scope === "state" && selectedState && selectedCountry && `Rankings for ${selectedState}, ${selectedCountry}`}
          {scope !== "global" && !selectedCountry && "Rankings"}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Season-wide EPA rankings for DECODE 2025-2026
        </p>
      </div>

      {/* Scope Filter Controls */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Scope pills */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(["global", "country", "state"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setScope(s);
                  if (s === "global") {
                    setSelectedCountry("");
                    setSelectedState("");
                  }
                  if (s === "country") {
                    setSelectedState("");
                  }
                }}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  scope === s
                    ? "bg-ftc-orange text-white"
                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {s === "global" ? "Global" : s === "country" ? "Country" : "State"}
              </button>
            ))}
          </div>

          {/* Country dropdown */}
          {scope !== "global" && filters && (
            <SearchableDropdown
              options={filters.countries}
              value={selectedCountry}
              onSelect={(v) => {
                setSelectedCountry(v);
                setSelectedState("");
              }}
              placeholder="Select country..."
              displayMap={COUNTRY_DISPLAY_NAMES}
            />
          )}

          {/* State dropdown */}
          {scope === "state" && selectedCountry && filters?.states[selectedCountry] && (
            <SearchableDropdown
              options={filters.states[selectedCountry]}
              value={selectedState}
              onSelect={setSelectedState}
              placeholder="Select state/region..."
            />
          )}

          {filtersLoading && scope !== "global" && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-ftc-orange border-t-transparent" />
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-ftc-orange">{data.totalTeams.toLocaleString()}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Teams Ranked</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-ftc-blue">{data.totalMatches.toLocaleString()}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Matches Analyzed</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{data.eventsProcessed}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Events Processed</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-purple-500">{formatRelativeTime(data.lastUpdated)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Last Updated</p>
        </div>
      </div>

      {/* Color Legend */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
          <span className="text-gray-500 dark:text-gray-400">Percentile:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-blue-500 dark:bg-blue-900/60" />
            <span className="text-gray-600 dark:text-gray-300">Top 1%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-green-400 dark:bg-green-900/40" />
            <span className="text-gray-600 dark:text-gray-300">Top 10%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-green-200 dark:bg-green-800/40" />
            <span className="text-gray-600 dark:text-gray-300">Top 25%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
            <span className="text-gray-600 dark:text-gray-300">Middle 50%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-200 dark:bg-red-900/40" />
            <span className="text-gray-600 dark:text-gray-300">Bottom 25%</span>
          </span>
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-4">
        <div className="relative max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Filter by team number..."
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
          />
        </div>
      </div>

      {/* Rankings Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                  #
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                  Team
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                  EPA
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                  Auto EPA
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                  Teleop EPA
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                  Endgame EPA
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                  Matches
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {visibleRankings.map((team) => {
                const percentileClass = getPercentileClasses(team.rank, data.totalTeams);
                const isSearched = matchedTeamNumbers.has(team.teamNumber);
                return (
                  <tr
                    key={team.teamNumber}
                    className={`${percentileClass} hover:opacity-80 transition-opacity relative`}
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      <span className="flex items-center gap-1.5">
                        {isSearched && (
                          <span className="inline-block w-2 h-2 rounded-full bg-ftc-orange flex-shrink-0" />
                        )}
                        {team.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/analytics/team/${team.teamNumber}`}
                        className="text-ftc-orange hover:underline font-medium"
                      >
                        {team.teamNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      <span
                        className={
                          team.epa >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-500"
                        }
                      >
                        {team.epa >= 0 ? "+" : ""}
                        {team.epa.toFixed(1)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right font-mono text-sm">
                      {team.autoEpa >= 0 ? "+" : ""}
                      {team.autoEpa.toFixed(1)}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right font-mono text-sm">
                      {team.teleopEpa >= 0 ? "+" : ""}
                      {team.teleopEpa.toFixed(1)}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right font-mono text-sm">
                      {team.endgameEpa >= 0 ? "+" : ""}
                      {team.endgameEpa.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {team.matchCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {team.trend === "up" && (
                        <span className="text-green-600 dark:text-green-400 font-bold">&#8593;</span>
                      )}
                      {team.trend === "down" && (
                        <span className="text-red-500 font-bold">&#8595;</span>
                      )}
                      {team.trend === "stable" && (
                        <span className="text-gray-400 font-bold">&#8594;</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Empty filter state */}
          {filteredRankings.length === 0 && teamFilter && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No teams match &quot;{teamFilter}&quot;
            </div>
          )}

          {/* Empty data state */}
          {data.rankings.length === 0 && !teamFilter && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No ranking data available yet. Check back after matches have been played.
            </div>
          )}
        </div>

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="border-t border-gray-200 dark:border-gray-800 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-ftc-orange border-t-transparent" />
              Loading more teams...
            </div>
          </div>
        )}

        {/* Showing count footer */}
        {filteredRankings.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
            Showing {Math.min(visibleCount, filteredRankings.length).toLocaleString()} of{" "}
            {filteredRankings.length.toLocaleString()} teams
            {teamFilter && ` matching "${teamFilter}"`}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GlobalRankingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      }
    >
      <GlobalRankingsContent />
    </Suspense>
  );
}
