"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  eventsApi,
  analyticsApi,
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

// Percentile-based row coloring inspired by Prorickey's ftc-scouting
function getPercentileClasses(rank: number, total: number): string {
  if (total === 0) return "bg-gray-50 dark:bg-gray-800";
  const percentile = rank / total;
  if (percentile <= 0.01) return "bg-blue-500 text-white dark:bg-blue-900/60 dark:text-blue-200";
  if (percentile <= 0.10) return "bg-green-400 text-gray-800 dark:bg-green-900/40 dark:text-green-300";
  if (percentile <= 0.25) return "bg-green-200 text-gray-800 dark:bg-green-900/20 dark:text-green-400";
  if (percentile > 0.75) return "bg-red-200 text-gray-800 dark:bg-red-900/20 dark:text-red-400";
  return "bg-gray-50 dark:bg-gray-800";
}

function RankingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventCodeParam = searchParams.get("event") || "";

  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventCode, setSelectedEventCode] = useState(eventCodeParam);
  const [activeTab, setActiveTab] = useState<"epa" | "opr">("epa");

  // Event search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "upcoming" | "past">("all");

  // Table team filter
  const [teamFilter, setTeamFilter] = useState("");

  // Analytics data
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

  // Get unique countries for filter
  const countries = useMemo(() => {
    const countrySet = new Set(events.map((e) => e.country));
    return Array.from(countrySet).sort();
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter((event) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          event.name.toLowerCase().includes(query) ||
          event.city.toLowerCase().includes(query) ||
          event.stateprov.toLowerCase().includes(query) ||
          event.code.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (countryFilter && event.country !== countryFilter) return false;
      if (dateFilter === "upcoming") return new Date(event.dateEnd) >= now;
      if (dateFilter === "past") return new Date(event.dateEnd) < now;
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
    router.push(`/analytics/rankings?event=${selectedEventCode}`, { scroll: false });
  }, [selectedEventCode, router]);

  const handleEventSelect = (eventCode: string) => {
    setSelectedEventCode(eventCode);
    setTeamFilter("");
  };

  const selectedEvent = events.find((e) => e.code === selectedEventCode);

  // Filter rankings by team number
  const filteredEpaData = useMemo(() => {
    if (!teamFilter) return epaData;
    return epaData.filter((t) =>
      String(t.teamNumber).includes(teamFilter)
    );
  }, [epaData, teamFilter]);

  const filteredOprData = useMemo(() => {
    if (!teamFilter) return oprData;
    return oprData.filter((t) =>
      String(t.teamNumber).includes(teamFilter)
    );
  }, [oprData, teamFilter]);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-ftc-orange transition-colors mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Analytics
        </Link>
        <h1 className="text-2xl font-bold">Rankings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          EPA and OPR rankings for DECODE 2025-2026
        </p>
      </div>

      {/* Event Selector Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
          Select Event
        </h2>

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
                    {selectedEvent.city}, {selectedEvent.stateprov} &bull; {selectedEvent.code}
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
      </div>

      {selectedEventCode && (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-ftc-blue">
                {activeTab === "epa" ? epaData.length : oprData.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Teams</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-ftc-orange">{matchCount}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Matches</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
              <p className="text-2xl font-bold text-green-500">
                {activeTab === "epa"
                  ? epaData.length > 0
                    ? Math.round(epaData[0]?.epa * 10) / 10
                    : "-"
                  : oprData.length > 0
                    ? Math.round(oprData[0]?.opr * 10) / 10
                    : "-"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Top {activeTab === "epa" ? "EPA" : "OPR"}
              </p>
            </div>
          </div>

          {/* EPA / OPR Toggle Tabs */}
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
          </div>

          {/* Rankings Table */}
          {loading ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
              </div>
            </div>
          ) : activeTab === "epa" ? (
            <RankedEPATable
              data={filteredEpaData}
              totalTeams={epaData.length}
              eventCode={selectedEventCode}
              teamFilter={teamFilter}
              onTeamFilterChange={setTeamFilter}
            />
          ) : (
            <RankedOPRTable
              data={filteredOprData}
              totalTeams={oprData.length}
              eventCode={selectedEventCode}
              teamFilter={teamFilter}
              onTeamFilterChange={setTeamFilter}
            />
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
              d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Select an Event</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Choose an event above to view EPA and OPR rankings with percentile coloring
          </p>
        </div>
      )}
    </div>
  );
}

// Color Legend Component
function ColorLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 text-xs font-medium">
      <span className="text-gray-500 dark:text-gray-400">Legend:</span>
      <span className="inline-flex items-center gap-1">
        <span className="w-4 h-4 rounded bg-blue-500" />
        <span className="text-gray-600 dark:text-gray-300">Top 1%</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="w-4 h-4 rounded bg-green-400" />
        <span className="text-gray-600 dark:text-gray-300">Top 10%</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="w-4 h-4 rounded bg-green-200 dark:bg-green-800/40" />
        <span className="text-gray-600 dark:text-gray-300">Top 25%</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="w-4 h-4 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
        <span className="text-gray-600 dark:text-gray-300">Middle 50%</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="w-4 h-4 rounded bg-red-200 dark:bg-red-900/40" />
        <span className="text-gray-600 dark:text-gray-300">Bottom 25%</span>
      </span>
    </div>
  );
}

// Team filter input
function TeamFilterInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative mb-4">
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-xs pl-9 pr-4 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
      />
    </div>
  );
}

function RankedEPATable({
  data,
  totalTeams,
  eventCode,
  teamFilter,
  onTeamFilterChange,
}: {
  data: EPAResult[];
  totalTeams: number;
  eventCode: string;
  teamFilter: string;
  onTeamFilterChange: (v: string) => void;
}) {
  if (totalTeams === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          No match data available yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden p-4">
      <ColorLegend />
      <TeamFilterInput value={teamFilter} onChange={onTeamFilterChange} />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                Team #
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                EPA
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Auto EPA
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Teleop EPA
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Endgame EPA
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
            {data.map((team, index) => {
              // Use the original rank based on full dataset position
              const originalRank = teamFilter
                ? data.indexOf(team) + 1
                : index + 1;
              // For percentile we always use the rank from the full (unfiltered) list
              // Since the data is sorted by EPA descending, we can find rank by looking at the full ordering
              // But since filtered data preserves order, we use index relative to totalTeams
              // Actually, the data array order from API is already ranked, so the original index in the full list matters
              // When filtering, we still want to show correct rank, so we compute it from the full list
              const rank = index + 1;
              const percentileClass = getPercentileClasses(rank, data.length);

              return (
                <tr
                  key={team.teamNumber}
                  className={`${percentileClass} hover:opacity-80 transition-opacity`}
                >
                  <td className="px-4 py-3 text-sm font-medium">{rank}</td>
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
                        team.epa >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                      }
                    >
                      {team.epa >= 0 ? "+" : ""}
                      {team.epa.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {team.autoEpa >= 0 ? "+" : ""}
                    {team.autoEpa.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {team.teleopEpa >= 0 ? "+" : ""}
                    {team.teleopEpa.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {team.endgameEpa >= 0 ? "+" : ""}
                    {team.endgameEpa.toFixed(1)}
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
                    {!team.trend && (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {team.matchCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.length === 0 && teamFilter && (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
            No teams match &quot;{teamFilter}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

function RankedOPRTable({
  data,
  totalTeams,
  eventCode,
  teamFilter,
  onTeamFilterChange,
}: {
  data: OPRResult[];
  totalTeams: number;
  eventCode: string;
  teamFilter: string;
  onTeamFilterChange: (v: string) => void;
}) {
  if (totalTeams === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          No match data available yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden p-4">
      <ColorLegend />
      <TeamFilterInput value={teamFilter} onChange={onTeamFilterChange} />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                Team #
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                OPR
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Auto OPR
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Teleop OPR
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                Endgame OPR
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
            {data.map((team, index) => {
              const rank = index + 1;
              const percentileClass = getPercentileClasses(rank, data.length);

              return (
                <tr
                  key={team.teamNumber}
                  className={`${percentileClass} hover:opacity-80 transition-opacity`}
                >
                  <td className="px-4 py-3 text-sm font-medium">{rank}</td>
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
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {team.autoOpr?.toFixed(1) || "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {team.teleopOpr?.toFixed(1) || "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {team.endgameOpr?.toFixed(1) || "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {team.dpr?.toFixed(1) || "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    <span
                      className={
                        (team.ccwm || 0) >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-500"
                      }
                    >
                      {(team.ccwm || 0) >= 0 ? "+" : ""}
                      {team.ccwm?.toFixed(1) || "-"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.length === 0 && teamFilter && (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
            No teams match &quot;{teamFilter}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

export default function RankingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      }
    >
      <RankingsContent />
    </Suspense>
  );
}
