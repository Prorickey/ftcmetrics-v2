"use client";

import { useEffect, useState, useMemo, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  eventsApi,
  analyticsApi,
  ftcTeamsApi,
  type OPRResult,
  type EPAResult,
} from "@/lib/api";

interface Event {
  code: string;
  name: string;
  city: string;
  stateprov: string;
  country: string;
  dateStart: string;
  dateEnd: string;
}

interface TeamSearchResult {
  teamNumber: number;
  nameShort: string;
  nameFull: string;
  city: string | null;
  stateProv: string | null;
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventCodeParam = searchParams.get("event") || "";

  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventCode, setSelectedEventCode] = useState(eventCodeParam);
  const [activeTab, setActiveTab] = useState<"opr" | "epa">("epa");

  // Search mode toggle
  const [searchMode, setSearchMode] = useState<"event" | "team">("team");

  // Team search state
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [teamSearchResults, setTeamSearchResults] = useState<TeamSearchResult[]>([]);
  const [teamSearchLoading, setTeamSearchLoading] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const teamSearchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchCounterRef = useRef(0);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "upcoming" | "past">("all");

  const [oprData, setOprData] = useState<OPRResult[]>([]);
  const [epaData, setEpaData] = useState<EPAResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchCount, setMatchCount] = useState(0);

  // Fetch events
  useEffect(() => {
    async function fetchEvents() {
      try {
        const result = await eventsApi.getEvents();
        if (result.success && result.data) {
          // Sort by date (newest first)
          const sorted = result.data.sort(
            (a, b) =>
              new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime()
          );
          setEvents(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setEventsLoading(false);
      }
    }
    fetchEvents();
  }, []);

  // Close team dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        teamSearchRef.current &&
        !teamSearchRef.current.contains(e.target as Node)
      ) {
        setShowTeamDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced team search with race condition protection
  const handleTeamSearchInput = useCallback(
    (value: string) => {
      setTeamSearchQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        setTeamSearchResults([]);
        setShowTeamDropdown(false);
        searchCounterRef.current++;
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const thisSearch = ++searchCounterRef.current;
        setTeamSearchLoading(true);
        try {
          const result = await ftcTeamsApi.search(value.trim());
          // Discard stale responses: only update state if this is still the latest search
          if (thisSearch !== searchCounterRef.current) return;
          if (result.success && result.data) {
            setTeamSearchResults(result.data);
            setShowTeamDropdown(true);
          } else {
            setTeamSearchResults([]);
            setShowTeamDropdown(true);
          }
        } catch {
          if (thisSearch !== searchCounterRef.current) return;
          setTeamSearchResults([]);
          setShowTeamDropdown(true);
        } finally {
          if (thisSearch === searchCounterRef.current) {
            setTeamSearchLoading(false);
          }
        }
      }, 300);
    },
    []
  );

  // Handle Enter key to navigate directly to team page
  const handleTeamSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const trimmed = teamSearchQuery.trim();
        const isNumeric = /^\d+$/.test(trimmed);
        if (isNumeric && parseInt(trimmed, 10) > 0) {
          setShowTeamDropdown(false);
          router.push(`/analytics/team/${trimmed}`);
        } else if (teamSearchResults.length > 0) {
          setShowTeamDropdown(false);
          router.push(`/analytics/team/${teamSearchResults[0].teamNumber}`);
        }
      }
    },
    [teamSearchQuery, teamSearchResults, router]
  );

  // Get unique countries for filter
  const countries = useMemo(() => {
    const countrySet = new Set(events.map((e) => e.country));
    return Array.from(countrySet).sort();
  }, [events]);

  // Filter events based on search and filters
  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter((event) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          event.name.toLowerCase().includes(query) ||
          event.city.toLowerCase().includes(query) ||
          event.stateprov.toLowerCase().includes(query) ||
          event.code.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Country filter
      if (countryFilter && event.country !== countryFilter) {
        return false;
      }

      // Date filter
      if (dateFilter === "upcoming") {
        return new Date(event.dateEnd) >= now;
      } else if (dateFilter === "past") {
        return new Date(event.dateEnd) < now;
      }

      return true;
    });
  }, [events, searchQuery, countryFilter, dateFilter]);

  // Fetch analytics when event changes
  useEffect(() => {
    if (!selectedEventCode) return;

    async function fetchAnalytics() {
      setLoading(true);
      setOprData([]);
      setEpaData([]);
      setMatchCount(0);

      try {
        const [oprResult, epaResult] = await Promise.all([
          analyticsApi.getOPR(selectedEventCode),
          analyticsApi.getEPA(selectedEventCode),
        ]);

        if (oprResult.success && oprResult.data) {
          setOprData(oprResult.data.rankings);
          setMatchCount(oprResult.data.matchCount);
        }

        if (epaResult.success && epaResult.data) {
          setEpaData(epaResult.data.rankings);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();

    // Update URL with event code
    router.push(`/analytics?event=${selectedEventCode}`, { scroll: false });
  }, [selectedEventCode, router]);

  const handleEventSelect = (eventCode: string) => {
    setSelectedEventCode(eventCode);
  };

  const selectedEvent = events.find((e) => e.code === selectedEventCode);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          EPA and OPR rankings for DECODE 2025-2026
        </p>
      </div>

      {/* Search Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSearchMode("event")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              searchMode === "event"
                ? "bg-ftc-orange text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Find Event
          </button>
          <button
            onClick={() => setSearchMode("team")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              searchMode === "team"
                ? "bg-ftc-orange text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Find Team
          </button>
        </div>

        {/* Event Search Mode */}
        {searchMode === "event" && (
          <>
            {eventsLoading ? (
              <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ) : (
              <>
                {/* Search and Filters Row */}
                <div className="grid gap-3 md:grid-cols-4 mb-4">
                  {/* Search Box */}
                  <div className="md:col-span-2">
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
                        placeholder="Search events by name, city, or code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
                      />
                    </div>
                  </div>

                  {/* Country Filter */}
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
                  >
                    <option value="">All Countries</option>
                    {countries.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>

                  {/* Date Filter */}
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as "all" | "upcoming" | "past")}
                    className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
                  >
                    <option value="all">All Dates</option>
                    <option value="past">Past Events (with data)</option>
                    <option value="upcoming">Upcoming Events</option>
                  </select>
                </div>

                {/* Events List */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  {filteredEvents.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      No events found matching your filters
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredEvents.slice(0, 50).map((event) => (
                        <button
                          key={event.code}
                          onClick={() => handleEventSelect(event.code)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                            selectedEventCode === event.code
                              ? "bg-ftc-orange/10 border-l-4 border-ftc-orange"
                              : ""
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{event.name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {event.city}, {event.stateprov}, {event.country}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-mono text-gray-400">{event.code}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(event.dateStart).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                      {filteredEvents.length > 50 && (
                        <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
                          Showing 50 of {filteredEvents.length} events. Use search to narrow down.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Event Display */}
                {selectedEvent && (
                  <div className="mt-3 p-3 bg-ftc-orange/10 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium text-ftc-orange">{selectedEvent.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedEvent.city}, {selectedEvent.stateprov} • {selectedEvent.code}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedEventCode("")}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Team Search Mode */}
        {searchMode === "team" && (
          <div ref={teamSearchRef} className="relative">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
                placeholder="Search by team number or name (Enter to go)..."
                value={teamSearchQuery}
                onChange={(e) => handleTeamSearchInput(e.target.value)}
                onKeyDown={handleTeamSearchKeyDown}
                onFocus={() => {
                  if (teamSearchResults.length > 0) setShowTeamDropdown(true);
                }}
                className="w-full pl-10 pr-10 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
              />
              {teamSearchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-ftc-orange border-t-transparent" />
                </div>
              )}
            </div>

            {/* Dropdown results */}
            {showTeamDropdown && teamSearchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {teamSearchResults.map((team) => (
                  <button
                    key={team.teamNumber}
                    onClick={() => {
                      setShowTeamDropdown(false);
                      router.push(`/analytics/team/${team.teamNumber}`);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-ftc-orange text-lg min-w-[4rem]">
                        {team.teamNumber}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {team.nameShort || team.nameFull}
                        </p>
                        {(team.city || team.stateProv) && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {[team.city, team.stateProv]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No results message */}
            {showTeamDropdown &&
              teamSearchResults.length === 0 &&
              !teamSearchLoading &&
              teamSearchQuery.trim().length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {/^\d+$/.test(teamSearchQuery.trim()) ? (
                    <>
                      No cached results. Press <strong>Enter</strong> to look up team {teamSearchQuery.trim()} directly.
                    </>
                  ) : (
                    "No teams found. Try a team number or browse an event first to populate the search index."
                  )}
                </div>
              )}
          </div>
        )}
      </div>

      {selectedEventCode && (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-ftc-orange">{matchCount}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Matches</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-ftc-blue">
                {epaData.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Teams</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-green-500">
                {epaData.length > 0
                  ? Math.round(epaData[0]?.epa * 10) / 10
                  : "-"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Top EPA</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-purple-500">
                {oprData.length > 0
                  ? Math.round(oprData[0]?.opr * 10) / 10
                  : "-"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Top OPR</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab("epa")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "epa"
                  ? "bg-ftc-orange text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              EPA Rankings
            </button>
            <button
              onClick={() => setActiveTab("opr")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "opr"
                  ? "bg-ftc-orange text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              OPR Rankings
            </button>
            <Link
              href={`/analytics/predict?event=${selectedEventCode}`}
              className="px-4 py-2 bg-ftc-blue text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Match Predictor
            </Link>
            <Link
              href={`/analytics/rankings?event=${selectedEventCode}`}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Rankings
            </Link>
          </div>

          {/* Rankings Table */}
          {loading ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
              </div>
            </div>
          ) : activeTab === "epa" ? (
            <EPATable data={epaData} eventCode={selectedEventCode} />
          ) : (
            <OPRTable data={oprData} eventCode={selectedEventCode} />
          )}
        </>
      )}

      {!selectedEventCode && !eventsLoading && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Select an Event</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Search or filter events above to view EPA and OPR rankings
          </p>
        </div>
      )}
    </div>
  );
}

function EPATable({
  data,
  eventCode,
}: {
  data: EPAResult[];
  eventCode: string;
}) {
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          No match data available yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                Team
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                EPA
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Auto
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Teleop
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Endgame
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300">
                Trend
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Matches
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {data.map((team, index) => (
              <tr
                key={team.teamNumber}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td className="px-4 py-3 text-sm font-medium">{index + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/analytics/team/${team.teamNumber}?event=${eventCode}`}
                    className="text-ftc-orange hover:underline font-medium"
                  >
                    {team.teamNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium">
                  <span
                    className={
                      team.epa >= 0 ? "text-green-500" : "text-red-500"
                    }
                  >
                    {team.epa >= 0 ? "+" : ""}
                    {team.epa.toFixed(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                  {team.autoEpa >= 0 ? "+" : ""}
                  {team.autoEpa.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                  {team.teleopEpa >= 0 ? "+" : ""}
                  {team.teleopEpa.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                  {team.endgameEpa >= 0 ? "+" : ""}
                  {team.endgameEpa.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-center">
                  {team.trend === "up" && (
                    <span className="text-green-500">↑</span>
                  )}
                  {team.trend === "down" && (
                    <span className="text-red-500">↓</span>
                  )}
                  {team.trend === "stable" && (
                    <span className="text-gray-400">→</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                  {team.matchCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OPRTable({
  data,
  eventCode,
}: {
  data: OPRResult[];
  eventCode: string;
}) {
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          No match data available yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                Team
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                OPR
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Auto
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Teleop
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Endgame
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                DPR
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                CCWM
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {data.map((team, index) => (
              <tr
                key={team.teamNumber}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td className="px-4 py-3 text-sm font-medium">{index + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/analytics/team/${team.teamNumber}?event=${eventCode}`}
                    className="text-ftc-orange hover:underline font-medium"
                  >
                    {team.teamNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-ftc-blue">
                  {team.opr.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                  {team.autoOpr?.toFixed(1) || "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                  {team.teleopOpr?.toFixed(1) || "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                  {team.endgameOpr?.toFixed(1) || "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                  {team.dpr?.toFixed(1) || "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm">
                  <span
                    className={
                      (team.ccwm || 0) >= 0 ? "text-green-500" : "text-red-500"
                    }
                  >
                    {(team.ccwm || 0) >= 0 ? "+" : ""}
                    {team.ccwm?.toFixed(1) || "-"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
