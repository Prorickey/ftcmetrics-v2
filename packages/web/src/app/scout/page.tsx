"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { teamsApi, eventsApi } from "@/lib/api";

interface UserTeam {
  teamId: string;
  role: string;
  team: {
    id: string;
    teamNumber: number;
    name: string;
  };
}

interface FTCEvent {
  code: string;
  name: string;
  city: string;
  stateprov: string;
  country: string;
  dateStart: string;
  dateEnd: string;
  type: string;
}

function ScoutContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const preselectedTeamId = searchParams.get("team");

  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [events, setEvents] = useState<FTCEvent[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedEventCode, setSelectedEventCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(true);

  useEffect(() => {
    async function fetchTeams() {
      if (!session?.user?.id) return;

      try {
        const result = await teamsApi.getMyTeams(session.user.id);
        if (result.success && result.data) {
          setTeams(result.data);
          // Auto-select if preselected or only one team
          if (preselectedTeamId) {
            setSelectedTeam(preselectedTeamId);
          } else if (result.data.length === 1) {
            setSelectedTeam(result.data[0].teamId);
          }
        }
      } catch (err) {
        console.error("Failed to fetch teams:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, [session?.user?.id, preselectedTeamId]);

  useEffect(() => {
    async function fetchEvents() {
      setEventsLoading(true);
      try {
        const result = await eventsApi.getEvents();
        if (result.success && result.data) {
          // Sort by date (soonest first)
          const sorted = result.data.sort(
            (a, b) =>
              new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
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

  // Filter events based on search and date filter
  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter((event) => {
      // Date filter
      if (showUpcomingOnly && new Date(event.dateEnd) < now) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          event.name.toLowerCase().includes(query) ||
          event.city.toLowerCase().includes(query) ||
          event.stateprov.toLowerCase().includes(query) ||
          event.code.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [events, searchQuery, showUpcomingOnly]);

  const selectedEvent = events.find((e) => e.code === selectedEventCode);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
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
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h2 className="text-xl font-semibold mb-2">Join a Team First</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You need to be part of a team to submit scouting data
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/my-teams/join"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Join Team
          </Link>
          <Link
            href="/my-teams/create"
            className="px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Create Team
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Scout Matches</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          DECODE 2025-2026 Season
        </p>
      </div>

      {/* Team Selection */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <label className="block text-sm font-medium mb-2">Scouting As</label>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
        >
          <option value="">Select your team</option>
          {teams.map(({ teamId, team }) => (
            <option key={teamId} value={teamId}>
              {team.teamNumber} - {team.name}
            </option>
          ))}
        </select>
      </div>

      {/* Event Selection with Search */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <label className="block text-sm font-medium mb-3">Find Event</label>

        {eventsLoading ? (
          <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ) : (
          <>
            {/* Search and Filter Row */}
            <div className="flex gap-3 mb-4">
              {/* Search Box */}
              <div className="flex-1 relative">
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
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
                />
              </div>

              {/* Toggle for upcoming only */}
              <button
                onClick={() => setShowUpcomingOnly(!showUpcomingOnly)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  showUpcomingOnly
                    ? "bg-ftc-orange text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                }`}
              >
                Upcoming Only
              </button>
            </div>

            {/* Events List */}
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {filteredEvents.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No events found
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredEvents.slice(0, 30).map((event) => (
                    <button
                      key={event.code}
                      onClick={() => setSelectedEventCode(event.code)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        selectedEventCode === event.code
                          ? "bg-ftc-orange/10 border-l-4 border-ftc-orange"
                          : ""
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{event.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {event.city}, {event.stateprov}
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
                  {filteredEvents.length > 30 && (
                    <div className="p-2 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
                      Showing 30 of {filteredEvents.length}. Use search to narrow down.
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
      </div>

      {/* Start Scouting Button */}
      {selectedTeam && selectedEventCode ? (
        <Link
          href={`/scout/match?team=${selectedTeam}&event=${selectedEventCode}`}
          className="block w-full py-4 bg-ftc-orange text-white rounded-xl font-medium text-center hover:opacity-90 transition-opacity text-lg"
        >
          Start Scouting
        </Link>
      ) : (
        <button
          disabled
          className="block w-full py-4 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl font-medium text-center cursor-not-allowed text-lg"
        >
          Select team and event to start
        </button>
      )}

      {/* Recent Entries */}
      <div className="mt-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold text-lg mb-4">Recent Scouting Entries</h2>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No entries yet</p>
          <p className="text-sm mt-1">Your scouting submissions will appear here</p>
        </div>
      </div>
    </div>
  );
}

export default function ScoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      }
    >
      <ScoutContent />
    </Suspense>
  );
}
