"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  analyticsApi,
  ftcTeamsApi,
  scoutingApi,
  eventsApi,
  type OPRResult,
  type EPAResult,
} from "@/lib/api";

interface TeamInfo {
  teamNumber: number;
  nameFull: string;
  nameShort: string;
  city: string;
  stateProv: string;
  country: string;
  rookieYear: number;
}

interface ScoutingSummary {
  matchCount: number;
  averages: {
    autoScore: number;
    teleopScore: number;
    endgameScore: number;
    totalScore: number;
    autoLeaveRate: number;
    autoClassified: number;
    autoOverflow: number;
    teleopClassified: number;
    teleopOverflow: number;
    teleopDepot: number;
  } | null;
}

function TeamAnalyticsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const teamNumber = parseInt(params.teamNumber as string, 10);
  const eventCode = searchParams.get("event") || "";

  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [opr, setOpr] = useState<OPRResult | null>(null);
  const [epa, setEpa] = useState<EPAResult | null>(null);
  const [scoutingData, setScoutingData] = useState<ScoutingSummary | null>(null);
  const [events, setEvents] = useState<Array<{ eventCode: string; name: string }>>([]);
  const [selectedEvent, setSelectedEvent] = useState(eventCode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch team info
  useEffect(() => {
    async function fetchTeamInfo() {
      try {
        const result = await ftcTeamsApi.getTeam(teamNumber);
        if (result.success && result.data) {
          setTeamInfo(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch team info:", err);
      }
    }
    fetchTeamInfo();
  }, [teamNumber]);

  // Fetch events
  useEffect(() => {
    async function fetchEvents() {
      try {
        const result = await eventsApi.getEvents();
        if (result.success && result.data) {
          setEvents(result.data.map((e) => ({ eventCode: e.code, name: e.name })));
        }
      } catch (err) {
        console.error("Failed to fetch events:", err);
      }
    }
    fetchEvents();
  }, []);

  // Fetch analytics when event changes
  useEffect(() => {
    if (!selectedEvent) {
      setLoading(false);
      return;
    }

    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const [analyticsResult, scoutingResult] = await Promise.all([
          analyticsApi.getTeamAnalytics(teamNumber, selectedEvent),
          scoutingApi.getTeamSummary(teamNumber, selectedEvent),
        ]);

        if (analyticsResult.success && analyticsResult.data) {
          setOpr(analyticsResult.data.opr);
          setEpa(analyticsResult.data.epa);
        }

        if (scoutingResult.success && scoutingResult.data) {
          setScoutingData(scoutingResult.data);
        }
      } catch (err) {
        setError("Failed to fetch analytics");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [teamNumber, selectedEvent]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
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

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-ftc-orange">{teamNumber}</span>
              <h1 className="text-2xl font-bold">
                {teamInfo?.nameShort || teamInfo?.nameFull || `Team ${teamNumber}`}
              </h1>
            </div>
            {teamInfo && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {teamInfo.city}, {teamInfo.stateProv}, {teamInfo.country} | Rookie Year: {teamInfo.rookieYear}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Event Selection */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <label className="block text-sm font-medium mb-2">Event</label>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <option value="">Select an event</option>
          {events.map((event) => (
            <option key={event.eventCode} value={event.eventCode}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!selectedEvent ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Select an event to view team analytics
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      ) : (
        <>
          {/* EPA & OPR Cards */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* EPA Card */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">EPA</h2>
                {epa?.trend && (
                  <span
                    className={`text-sm ${
                      epa.trend === "up"
                        ? "text-green-500"
                        : epa.trend === "down"
                        ? "text-red-500"
                        : "text-gray-400"
                    }`}
                  >
                    {epa.trend === "up" ? "Trending Up" : epa.trend === "down" ? "Trending Down" : "Stable"}
                  </span>
                )}
              </div>

              {epa ? (
                <div className="space-y-4">
                  <div className="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-4xl font-bold">
                      <span className={epa.epa >= 0 ? "text-green-500" : "text-red-500"}>
                        {epa.epa >= 0 ? "+" : ""}{epa.epa.toFixed(1)}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Expected Points Added
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-lg font-semibold">
                        {epa.autoEpa >= 0 ? "+" : ""}{epa.autoEpa.toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500">Auto</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-lg font-semibold">
                        {epa.teleopEpa >= 0 ? "+" : ""}{epa.teleopEpa.toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500">Teleop</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-lg font-semibold">
                        {epa.endgameEpa >= 0 ? "+" : ""}{epa.endgameEpa.toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500">Endgame</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    Based on {epa.matchCount} matches
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No EPA data available
                </p>
              )}
            </div>

            {/* OPR Card */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="font-semibold text-lg mb-4">OPR</h2>

              {opr ? (
                <div className="space-y-4">
                  <div className="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-4xl font-bold text-ftc-blue">
                      {opr.opr.toFixed(1)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Offensive Power Rating
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-lg font-semibold">{opr.autoOpr?.toFixed(1) || "-"}</p>
                      <p className="text-xs text-gray-500">Auto</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-lg font-semibold">{opr.teleopOpr?.toFixed(1) || "-"}</p>
                      <p className="text-xs text-gray-500">Teleop</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-lg font-semibold">{opr.endgameOpr?.toFixed(1) || "-"}</p>
                      <p className="text-xs text-gray-500">Endgame</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-lg font-semibold">{opr.dpr?.toFixed(1) || "-"}</p>
                      <p className="text-xs text-gray-500">DPR</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className={`text-lg font-semibold ${(opr.ccwm || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {(opr.ccwm || 0) >= 0 ? "+" : ""}{opr.ccwm?.toFixed(1) || "-"}
                      </p>
                      <p className="text-xs text-gray-500">CCWM</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No OPR data available
                </p>
              )}
            </div>
          </div>

          {/* Scouting Data */}
          {scoutingData && scoutingData.averages && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
              <h2 className="font-semibold text-lg mb-4">
                Scouting Averages ({scoutingData.matchCount} entries)
              </h2>

              <div className="grid gap-6 md:grid-cols-3">
                {/* Auto */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Autonomous</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Leave Rate</span>
                      <span className="font-medium">
                        {Math.round(scoutingData.averages.autoLeaveRate * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Classified</span>
                      <span className="font-medium">{scoutingData.averages.autoClassified.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Overflow</span>
                      <span className="font-medium">{scoutingData.averages.autoOverflow.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-medium">Avg Score</span>
                      <span className="font-bold text-ftc-orange">
                        {scoutingData.averages.autoScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Teleop */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Teleop</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Classified</span>
                      <span className="font-medium">{scoutingData.averages.teleopClassified.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Overflow</span>
                      <span className="font-medium">{scoutingData.averages.teleopOverflow.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Depot</span>
                      <span className="font-medium">{scoutingData.averages.teleopDepot.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-medium">Avg Score</span>
                      <span className="font-bold text-ftc-blue">
                        {scoutingData.averages.teleopScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Endgame & Total */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Endgame</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Avg Score</span>
                      <span className="font-medium">{scoutingData.averages.endgameScore.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                      <span className="text-sm font-bold">Total Avg</span>
                      <span className="font-bold text-green-500 text-lg">
                        {scoutingData.averages.totalScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-4">
            <Link
              href={`/analytics/predict?event=${selectedEvent}`}
              className="flex-1 py-3 bg-ftc-orange text-white rounded-lg font-medium text-center hover:opacity-90 transition-opacity"
            >
              Predict Match with Team
            </Link>
            <Link
              href={`/scout?teamNumber=${teamNumber}`}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium text-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Scout This Team
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function TeamAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      }
    >
      <TeamAnalyticsContent />
    </Suspense>
  );
}
