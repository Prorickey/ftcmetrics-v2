"use client";

import { useEffect, useState, Suspense } from "react";
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
    Array<{ eventCode: string; name: string; city: string; stateProv: string }>
  >([]);
  const [eventTeams, setEventTeams] = useState<EventTeam[]>([]);
  const [selectedEvent, setSelectedEvent] = useState(initialEvent);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(false);

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
          setEvents(result.data);
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
        <label className="block text-sm font-medium mb-2">Event</label>
        {eventsLoading ? (
          <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ) : (
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <option value="">Select event</option>
            {events.map((event) => (
              <option key={event.eventCode} value={event.eventCode}>
                {event.name}
              </option>
            ))}
          </select>
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
