"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { eventsApi, analyticsApi } from "@/lib/api";

interface EventTeam {
  teamNumber: number;
  nameFull: string;
  nameShort: string;
}

interface Prediction {
  redScore: number;
  blueScore: number;
  redWinProbability: number;
  blueWinProbability: number;
  predictedWinner: "red" | "blue";
  margin: number;
}

function PredictContent() {
  const searchParams = useSearchParams();
  const initialEvent = searchParams.get("event") || "";

  const [events, setEvents] = useState<
    Array<{ code: string; name: string; city: string; stateprov: string; country: string; dateStart: string; dateEnd: string }>
  >([]);
  const [eventTeams, setEventTeams] = useState<EventTeam[]>([]);
  const [selectedEvent, setSelectedEvent] = useState(initialEvent);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "upcoming" | "past">("all");

  const [redTeam1, setRedTeam1] = useState<number>(0);
  const [redTeam2, setRedTeam2] = useState<number>(0);
  const [blueTeam1, setBlueTeam1] = useState<number>(0);
  const [blueTeam2, setBlueTeam2] = useState<number>(0);

  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch teams when event changes
  useEffect(() => {
    if (!selectedEvent) return;

    async function fetchTeams() {
      setTeamsLoading(true);
      setPrediction(null);
      try {
        const result = await eventsApi.getEventTeams(selectedEvent);
        if (result.success && result.data) {
          setEventTeams(
            result.data.sort((a, b) => a.teamNumber - b.teamNumber)
          );
        }
      } catch (err) {
        console.error("Failed to fetch teams:", err);
      } finally {
        setTeamsLoading(false);
      }
    }

    fetchTeams();
  }, [selectedEvent]);

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

  const selectedEventInfo = events.find((e) => e.code === selectedEvent);

  const handlePredict = async () => {
    if (!redTeam1 || !redTeam2 || !blueTeam1 || !blueTeam2) {
      setError("Please select all 4 teams");
      return;
    }

    setPredicting(true);
    setError(null);

    try {
      const result = await analyticsApi.predictMatch({
        eventCode: selectedEvent,
        redTeam1,
        redTeam2,
        blueTeam1,
        blueTeam2,
      });

      if (result.success && result.data) {
        setPrediction(result.data.prediction);
      } else {
        setError(result.error || "Failed to predict match");
      }
    } catch (err) {
      setError("Failed to predict match");
    } finally {
      setPredicting(false);
    }
  };

  const getTeamName = (teamNumber: number) => {
    const team = eventTeams.find((t) => t.teamNumber === teamNumber);
    return team?.nameShort || team?.nameFull || `Team ${teamNumber}`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href={`/analytics${selectedEvent ? `?event=${selectedEvent}` : ""}`}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Analytics
        </Link>
        <h1 className="text-2xl font-bold">Match Predictor</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Predict match outcomes using EPA data
        </p>
      </div>

      {/* Event Selection */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <label className="block text-sm font-medium mb-3">Event</label>
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
                      onClick={() => setSelectedEvent(event.code)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        selectedEvent === event.code
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
            {selectedEventInfo && (
              <div className="mt-3 p-3 bg-ftc-orange/10 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium text-ftc-orange">{selectedEventInfo.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedEventInfo.city}, {selectedEventInfo.stateprov} • {selectedEventInfo.code}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEvent("")}
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

      {selectedEvent && (
        <>
          {/* Team Selection */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {/* Red Alliance */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-800 p-6">
              <h2 className="font-semibold text-lg text-red-500 mb-4">
                Red Alliance
              </h2>
              {teamsLoading ? (
                <div className="space-y-3">
                  <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                  <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Team 1
                    </label>
                    <select
                      value={redTeam1}
                      onChange={(e) => setRedTeam1(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <option value={0}>Select team</option>
                      {eventTeams.map((team) => (
                        <option key={team.teamNumber} value={team.teamNumber}>
                          {team.teamNumber} - {team.nameShort || team.nameFull}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Team 2
                    </label>
                    <select
                      value={redTeam2}
                      onChange={(e) => setRedTeam2(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <option value={0}>Select team</option>
                      {eventTeams.map((team) => (
                        <option key={team.teamNumber} value={team.teamNumber}>
                          {team.teamNumber} - {team.nameShort || team.nameFull}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Blue Alliance */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
              <h2 className="font-semibold text-lg text-blue-500 mb-4">
                Blue Alliance
              </h2>
              {teamsLoading ? (
                <div className="space-y-3">
                  <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                  <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Team 1
                    </label>
                    <select
                      value={blueTeam1}
                      onChange={(e) => setBlueTeam1(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <option value={0}>Select team</option>
                      {eventTeams.map((team) => (
                        <option key={team.teamNumber} value={team.teamNumber}>
                          {team.teamNumber} - {team.nameShort || team.nameFull}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Team 2
                    </label>
                    <select
                      value={blueTeam2}
                      onChange={(e) => setBlueTeam2(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <option value={0}>Select team</option>
                      {eventTeams.map((team) => (
                        <option key={team.teamNumber} value={team.teamNumber}>
                          {team.teamNumber} - {team.nameShort || team.nameFull}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Predict Button */}
          <button
            onClick={handlePredict}
            disabled={predicting || !redTeam1 || !redTeam2 || !blueTeam1 || !blueTeam2}
            className="w-full py-4 bg-ftc-orange text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 text-lg mb-6"
          >
            {predicting ? "Predicting..." : "Predict Match"}
          </button>

          {/* Prediction Result */}
          {prediction && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-center">
                  Match Prediction
                </h3>

                {/* Score Display */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div
                    className={`text-center p-4 rounded-lg ${
                      prediction.predictedWinner === "red"
                        ? "bg-red-100 dark:bg-red-900/30"
                        : "bg-gray-100 dark:bg-gray-800"
                    }`}
                  >
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Red Alliance
                    </p>
                    <p className="text-4xl font-bold text-red-500">
                      {prediction.redScore}
                    </p>
                    <p className="text-sm mt-1">
                      {getTeamName(redTeam1)} + {getTeamName(redTeam2)}
                    </p>
                  </div>

                  <div className="flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-400">VS</span>
                  </div>

                  <div
                    className={`text-center p-4 rounded-lg ${
                      prediction.predictedWinner === "blue"
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-gray-100 dark:bg-gray-800"
                    }`}
                  >
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Blue Alliance
                    </p>
                    <p className="text-4xl font-bold text-blue-500">
                      {prediction.blueScore}
                    </p>
                    <p className="text-sm mt-1">
                      {getTeamName(blueTeam1)} + {getTeamName(blueTeam2)}
                    </p>
                  </div>
                </div>

                {/* Win Probability */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-red-500">
                      {Math.round(prediction.redWinProbability * 100)}%
                    </span>
                    <span className="text-gray-500">Win Probability</span>
                    <span className="text-blue-500">
                      {Math.round(prediction.blueWinProbability * 100)}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                    <div
                      className="bg-red-500 transition-all duration-500"
                      style={{
                        width: `${prediction.redWinProbability * 100}%`,
                      }}
                    />
                    <div
                      className="bg-blue-500 transition-all duration-500"
                      style={{
                        width: `${prediction.blueWinProbability * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <p className="text-center text-gray-600 dark:text-gray-400">
                  Predicted margin: {prediction.margin} points
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PredictPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      }
    >
      <PredictContent />
    </Suspense>
  );
}
