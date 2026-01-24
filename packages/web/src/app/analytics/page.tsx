"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  eventsApi,
  analyticsApi,
  type OPRResult,
  type EPAResult,
} from "@/lib/api";

interface Event {
  eventCode: string;
  name: string;
  city: string;
  stateProv: string;
  dateStart: string;
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventCode = searchParams.get("event") || "";

  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(eventCode);
  const [activeTab, setActiveTab] = useState<"opr" | "epa">("epa");

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
          // Sort by date
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

  // Fetch analytics when event changes
  useEffect(() => {
    if (!selectedEvent) return;

    async function fetchAnalytics() {
      setLoading(true);
      try {
        const [oprResult, epaResult] = await Promise.all([
          analyticsApi.getOPR(selectedEvent),
          analyticsApi.getEPA(selectedEvent),
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

    // Update URL
    router.push(`/analytics?event=${selectedEvent}`, { scroll: false });
  }, [selectedEvent, router]);

  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEvent(e.target.value);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          EPA and OPR rankings for DECODE 2025-2026
        </p>
      </div>

      {/* Event Selection */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <label className="block text-sm font-medium mb-2">Select Event</label>
        {eventsLoading ? (
          <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ) : (
          <select
            value={selectedEvent}
            onChange={handleEventChange}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
          >
            <option value="">Choose an event</option>
            {events.map((event) => (
              <option key={event.eventCode} value={event.eventCode}>
                {event.name} ({event.city}, {event.stateProv})
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedEvent && (
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
              href={`/analytics/predict?event=${selectedEvent}`}
              className="px-4 py-2 bg-ftc-blue text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Match Predictor
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
            <EPATable data={epaData} eventCode={selectedEvent} />
          ) : (
            <OPRTable data={oprData} eventCode={selectedEvent} />
          )}
        </>
      )}

      {!selectedEvent && !eventsLoading && (
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
            Choose an event above to view EPA and OPR rankings
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
