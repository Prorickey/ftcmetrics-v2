"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  analyticsApi,
  ftcTeamsApi,
  rankingsApi,
  scoutingApi,
  type OPRResult,
  type EPAResult,
  type TeamMatchBreakdown,
} from "@/lib/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TeamInfo {
  teamNumber: number;
  nameFull: string;
  nameShort: string;
  city: string;
  stateProv: string;
  country: string;
  rookieYear: number;
}

interface EventSummary {
  eventCode: string;
  eventName: string;
  city: string | null;
  stateProv: string | null;
  dateStart: string;
  rank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  qualAverage: number | null;
}

interface EventDetail {
  opr: OPRResult | null;
  epa: EPAResult | null;
  scouting: {
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
  } | null;
  matches: TeamMatchBreakdown[] | null;
}

interface SeasonalDataPoint {
  eventCode: string;
  eventName: string;
  shortName: string;
  epa: number | null;
  opr: number | null;
  autoEpa: number | null;
  teleopEpa: number | null;
  endgameEpa: number | null;
  autoOpr: number | null;
  teleopOpr: number | null;
  endgameOpr: number | null;
}

function abbreviateEventName(name: string): string {
  if (name.length <= 18) return name;
  // Try removing common prefixes/suffixes
  const shortened = name
    .replace(/FIRST Tech Challenge /i, "")
    .replace(/ Qualifier/i, " Qual")
    .replace(/ Championship/i, " Champ")
    .replace(/ Tournament/i, " Tourn")
    .replace(/ Regional/i, " Reg")
    .replace(/ Invitational/i, " Inv");
  if (shortened.length <= 18) return shortened;
  return shortened.substring(0, 16) + "...";
}

function SeasonalPerformance({ data, loading }: { data: SeasonalDataPoint[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-6" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
        <div className="h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mt-6" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Seasonal Performance</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No seasonal data available
        </p>
      </div>
    );
  }

  const epaData = data.filter((d) => d.epa !== null);
  const oprData = data.filter((d) => d.opr !== null);

  // Find the most recent event with component breakdown data
  const latestWithBreakdown = [...data]
    .reverse()
    .find(
      (d) =>
        d.autoEpa !== null ||
        d.teleopEpa !== null ||
        d.endgameEpa !== null
    );

  const hasEpaChart = epaData.length > 0;
  const hasOprChart = oprData.length > 0;
  const hasBreakdown = latestWithBreakdown !== null && latestWithBreakdown !== undefined;

  if (!hasEpaChart && !hasOprChart) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Seasonal Performance</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No seasonal data available
        </p>
      </div>
    );
  }

  const breakdownData = hasBreakdown
    ? [
        {
          name: "Auto",
          epa: latestWithBreakdown.autoEpa ?? 0,
          opr: latestWithBreakdown.autoOpr ?? 0,
        },
        {
          name: "Teleop",
          epa: latestWithBreakdown.teleopEpa ?? 0,
          opr: latestWithBreakdown.teleopOpr ?? 0,
        },
        {
          name: "Endgame",
          epa: latestWithBreakdown.endgameEpa ?? 0,
          opr: latestWithBreakdown.endgameOpr ?? 0,
        },
      ]
    : [];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1">Seasonal Performance</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Across {data.length} event{data.length !== 1 ? "s" : ""}
      </p>

      {/* EPA and OPR charts side by side on desktop */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* EPA Line Chart */}
        {hasEpaChart && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              EPA Across Events
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={epaData}
                margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-gray-200 dark:text-gray-700"
                />
                <XAxis
                  dataKey="shortName"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#f3f4f6",
                    fontSize: 13,
                  }}
                  labelFormatter={(_, payload) => {
                    if (payload && payload.length > 0) {
                      return payload[0]?.payload?.eventName || "";
                    }
                    return "";
                  }}
                  formatter={(value) => {
                    const v = Number(value) || 0;
                    return [`${v >= 0 ? "+" : ""}${v.toFixed(1)}`, "EPA"];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="epa"
                  stroke="#f57c25"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#f57c25", strokeWidth: 0 }}
                  activeDot={{ r: 7, fill: "#f57c25", strokeWidth: 2, stroke: "#fff" }}
                  name="EPA"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* OPR Bar Chart */}
        {hasOprChart && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              OPR Across Events
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={oprData}
                margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-gray-200 dark:text-gray-700"
                />
                <XAxis
                  dataKey="shortName"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#f3f4f6",
                    fontSize: 13,
                  }}
                  labelFormatter={(_, payload) => {
                    if (payload && payload.length > 0) {
                      return payload[0]?.payload?.eventName || "";
                    }
                    return "";
                  }}
                  formatter={(value) => [(Number(value) || 0).toFixed(1), "OPR"]}
                />
                <Bar
                  dataKey="opr"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name="OPR"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Component Breakdown Chart */}
      {hasBreakdown && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Component Breakdown
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            {latestWithBreakdown.eventName}
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={breakdownData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-gray-200 dark:text-gray-700"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#9ca3af" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(17, 24, 39, 0.95)",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#f3f4f6",
                  fontSize: 13,
                }}
                formatter={(value, name) => {
                  const v = Number(value) || 0;
                  const label = name === "epa" ? "EPA" : "OPR";
                  const prefix = name === "epa" && v >= 0 ? "+" : "";
                  return [`${prefix}${v.toFixed(1)}`, label];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar
                dataKey="epa"
                name="EPA"
                fill="#f57c25"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="opr"
                name="OPR"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function TeamAnalyticsContent() {
  const params = useParams();
  const teamNumber = parseInt(params.teamNumber as string, 10);

  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [eventSummaries, setEventSummaries] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<
    Record<string, EventDetail>
  >({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [seasonalData, setSeasonalData] = useState<SeasonalDataPoint[]>([]);
  const [seasonalLoading, setSeasonalLoading] = useState(true);
  const [teamRankings, setTeamRankings] = useState<{
    worldRank: number;
    worldTotal: number;
    countryRank: number | null;
    countryTotal: number | null;
    country: string | null;
    stateRank: number | null;
    stateTotal: number | null;
    stateProv: string | null;
    epa: number;
    autoEpa: number;
    teleopEpa: number;
    endgameEpa: number;
    autoWorldRank: number | null;
    teleopWorldRank: number | null;
    endgameWorldRank: number | null;
    autoCountryRank: number | null;
    teleopCountryRank: number | null;
    endgameCountryRank: number | null;
    autoStateRank: number | null;
    teleopStateRank: number | null;
    endgameStateRank: number | null;
    opr: number | null;
    autoOpr: number | null;
    teleopOpr: number | null;
    endgameOpr: number | null;
    oprWorldRank: number | null;
    oprWorldTotal: number | null;
    oprCountryRank: number | null;
    oprStateRank: number | null;
    autoOprWorldRank: number | null;
    teleopOprWorldRank: number | null;
    endgameOprWorldRank: number | null;
    autoOprCountryRank: number | null;
    teleopOprCountryRank: number | null;
    endgameOprCountryRank: number | null;
    autoOprStateRank: number | null;
    teleopOprStateRank: number | null;
    endgameOprStateRank: number | null;
  } | null>(null);
  const [rankingsLoading, setRankingsLoading] = useState(true);

  // Fetch team info and event summaries in parallel
  useEffect(() => {
    console.log("[Analytics] useEffect fired for team:", teamNumber);
    async function fetchData() {
      console.log("[Analytics] Fetching data for team", teamNumber);
      setLoading(true);
      setSeasonalLoading(true);
      try {
        console.log("[Analytics] Making parallel API calls for team info, summaries, and rankings");
        const [teamResult, summariesResult, rankingsResult] = await Promise.all([
          ftcTeamsApi.getTeam(teamNumber),
          ftcTeamsApi.getTeamEventSummaries(teamNumber),
          rankingsApi.getTeamRankings(teamNumber).catch(() => null),
        ]);

        console.log("[Analytics] API responses received. Team:", teamResult.success, "Summaries:", summariesResult.success, "Rankings:", rankingsResult?.success);

        if (rankingsResult?.success && rankingsResult.data) {
          console.log("[Analytics] Rankings data loaded:", rankingsResult.data);
          setTeamRankings(rankingsResult.data);
        }

        if (teamResult.success && teamResult.data) {
          console.log("[Analytics] Team info loaded:", teamResult.data.teamNumber, teamResult.data.nameFull);
          setTeamInfo(teamResult.data);
        }

        let summaries: EventSummary[] = [];
        if (summariesResult.success && summariesResult.data) {
          summaries = summariesResult.data;
          console.log("[Analytics] Event summaries loaded:", summaries.length, "events");
          setEventSummaries(summaries);
        }

        setLoading(false);

        // Now fetch EPA/OPR for all past events in parallel for the seasonal charts.
        // This is in a separate try/catch so that an error here does not prevent the
        // main event list from displaying, and so that seasonal state is always resolved.
        try {
          const now = new Date();
          const pastEvents = summaries
            .filter((e) => new Date(e.dateStart) < now)
            .sort(
              (a, b) =>
                new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
            );

          console.log("[Analytics] Fetching seasonal analytics for", pastEvents.length, "past events");

          if (pastEvents.length > 0) {
            const analyticsResults = await Promise.all(
              pastEvents.map((event) =>
                analyticsApi
                  .getTeamAnalytics(teamNumber, event.eventCode)
                  .then((result) => ({
                    eventCode: event.eventCode,
                    eventName: event.eventName,
                    result,
                  }))
                  .catch(() => ({
                    eventCode: event.eventCode,
                    eventName: event.eventName,
                    result: { success: false as const, data: null, error: "Failed" },
                  }))
              )
            );

            console.log("[Analytics] Seasonal API responses received:", analyticsResults.length, "events processed");

            const seasonal: SeasonalDataPoint[] = analyticsResults.map(
              ({ eventCode, eventName, result }) => {
                const epa = result.success ? result.data?.epa ?? null : null;
                const opr = result.success ? result.data?.opr ?? null : null;
                return {
                  eventCode,
                  eventName,
                  shortName: abbreviateEventName(eventName),
                  epa: epa?.epa ?? null,
                  opr: opr?.opr ?? null,
                  autoEpa: epa?.autoEpa ?? null,
                  teleopEpa: epa?.teleopEpa ?? null,
                  endgameEpa: epa?.endgameEpa ?? null,
                  autoOpr: opr?.autoOpr ?? null,
                  teleopOpr: opr?.teleopOpr ?? null,
                  endgameOpr: opr?.endgameOpr ?? null,
                };
              }
            );

            console.log("[Analytics] Seasonal data processed:", seasonal.length, "data points");
            setSeasonalData(seasonal);
          } else {
            console.log("[Analytics] No past events found");
            setSeasonalData([]);
          }
        } catch (seasonalErr) {
          console.error("[Analytics] Failed to fetch seasonal analytics:", seasonalErr);
          setSeasonalData([]);
        } finally {
          setSeasonalLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch team data:", err);
        setLoading(false);
        setSeasonalData([]);
        setSeasonalLoading(false);
      } finally {
        setRankingsLoading(false);
      }
    }
    fetchData();
  }, [teamNumber]);

  const handleExpandEvent = useCallback(
    async (eventCode: string) => {
      console.log("[Analytics] handleExpandEvent called for eventCode:", eventCode, "currently expanded:", expandedEvent);
      if (expandedEvent === eventCode) {
        console.log("[Analytics] Collapsing event details");
        setExpandedEvent(null);
        return;
      }

      console.log("[Analytics] Expanding event details for:", eventCode);
      setExpandedEvent(eventCode);

      // If we already have cached detail data, don't refetch
      if (eventDetails[eventCode]) {
        console.log("[Analytics] Using cached event details for:", eventCode);
        return;
      }

      console.log("[Analytics] Fetching event details for:", eventCode);
      setDetailLoading(eventCode);
      try {
        console.log("[Analytics] Making parallel calls for analytics, scouting, and matches");
        const [analyticsResult, scoutingResult, matchesResult] = await Promise.all([
          analyticsApi.getTeamAnalytics(teamNumber, eventCode),
          scoutingApi.getTeamSummary(teamNumber, eventCode),
          analyticsApi.getTeamMatches(teamNumber, eventCode),
        ]);

        console.log("[Analytics] Event detail responses received. Analytics:", analyticsResult.success, "Scouting:", scoutingResult.success, "Matches:", matchesResult.success);

        setEventDetails((prev) => ({
          ...prev,
          [eventCode]: {
            opr: analyticsResult.success ? analyticsResult.data?.opr ?? null : null,
            epa: analyticsResult.success ? analyticsResult.data?.epa ?? null : null,
            scouting: scoutingResult.success ? scoutingResult.data ?? null : null,
            matches: matchesResult.success ? matchesResult.data?.matches ?? null : null,
          },
        }));
      } catch (err) {
        console.error("[Analytics] Error fetching event details:", err);
        setEventDetails((prev) => ({
          ...prev,
          [eventCode]: { opr: null, epa: null, scouting: null, matches: null },
        }));
      } finally {
        setDetailLoading(null);
      }
    },
    [expandedEvent, eventDetails, teamNumber]
  );

  const now = new Date();
  const pastEvents = eventSummaries.filter(
    (e) => new Date(e.dateStart) < now
  );
  const upcomingEvents = eventSummaries.filter(
    (e) => new Date(e.dateStart) >= now
  );

  if (isNaN(teamNumber)) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Invalid Team Number</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The team number in the URL is not valid. Please check the link and try again.
        </p>
        <Link
          href="/analytics"
          className="px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90"
        >
          Back to Analytics
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/analytics"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Analytics
        </Link>

        {loading ? (
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-ftc-orange">
                  {teamNumber}
                </span>
                <h1 className="text-2xl font-bold">
                  {teamInfo?.nameShort || teamInfo?.nameFull || `Team ${teamNumber}`}
                </h1>
              </div>
              {teamInfo && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {[teamInfo.city, teamInfo.stateProv, teamInfo.country]
                    .filter(Boolean)
                    .join(", ")}
                  {teamInfo.rookieYear && ` | Rookie Year: ${teamInfo.rookieYear}`}
                </p>
              )}
              {/* Season Rankings Card */}
              {rankingsLoading && (
                <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
              )}
              {!rankingsLoading && teamRankings && (
                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  {/* EPA Rankings Card */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                      Season Rankings (EPA)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 dark:text-gray-400">
                            <th className="text-left font-medium pb-2 pr-3">Metric</th>
                            <th className="text-center font-medium pb-2 px-2">
                              <span className="text-ftc-orange">World</span>
                            </th>
                            {teamRankings.countryRank !== null && teamRankings.country && (
                              <th className="text-center font-medium pb-2 px-2">
                                <span className="text-blue-600 dark:text-blue-400">{teamRankings.country}</span>
                              </th>
                            )}
                            {teamRankings.stateRank !== null && teamRankings.stateProv && (
                              <th className="text-center font-medium pb-2 px-2">
                                <span className="text-green-600 dark:text-green-400">{teamRankings.stateProv}</span>
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {[
                            { label: "Overall EPA", world: teamRankings.worldRank, country: teamRankings.countryRank, state: teamRankings.stateRank },
                            { label: "Auto", world: teamRankings.autoWorldRank, country: teamRankings.autoCountryRank, state: teamRankings.autoStateRank },
                            { label: "Teleop", world: teamRankings.teleopWorldRank, country: teamRankings.teleopCountryRank, state: teamRankings.teleopStateRank },
                            { label: "Endgame", world: teamRankings.endgameWorldRank, country: teamRankings.endgameCountryRank, state: teamRankings.endgameStateRank },
                          ].map((row) => (
                            <tr key={row.label}>
                              <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-300">{row.label}</td>
                              <td className="py-1.5 px-2 text-center font-mono text-ftc-orange">
                                {row.world !== null ? (
                                  <>#{row.world} <span className="text-gray-400 font-sans">/ {teamRankings.worldTotal}</span></>
                                ) : "-"}
                              </td>
                              {teamRankings.countryRank !== null && teamRankings.country && (
                                <td className="py-1.5 px-2 text-center font-mono text-blue-600 dark:text-blue-400">
                                  {row.country !== null ? (
                                    <>#{row.country} <span className="text-gray-400 font-sans">/ {teamRankings.countryTotal}</span></>
                                  ) : "-"}
                                </td>
                              )}
                              {teamRankings.stateRank !== null && teamRankings.stateProv && (
                                <td className="py-1.5 px-2 text-center font-mono text-green-600 dark:text-green-400">
                                  {row.state !== null ? (
                                    <>#{row.state} <span className="text-gray-400 font-sans">/ {teamRankings.stateTotal}</span></>
                                  ) : "-"}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* OPR Rankings Card */}
                  {teamRankings.oprWorldRank !== null && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                        Season Rankings (OPR)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 dark:text-gray-400">
                              <th className="text-left font-medium pb-2 pr-3">Metric</th>
                              <th className="text-center font-medium pb-2 px-2">
                                <span className="text-blue-600 dark:text-blue-400">World</span>
                              </th>
                              {teamRankings.oprCountryRank !== null && teamRankings.country && (
                                <th className="text-center font-medium pb-2 px-2">
                                  <span className="text-blue-600 dark:text-blue-400">{teamRankings.country}</span>
                                </th>
                              )}
                              {teamRankings.oprStateRank !== null && teamRankings.stateProv && (
                                <th className="text-center font-medium pb-2 px-2">
                                  <span className="text-green-600 dark:text-green-400">{teamRankings.stateProv}</span>
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {[
                              { label: "Overall OPR", world: teamRankings.oprWorldRank, worldTotal: teamRankings.oprWorldTotal, country: teamRankings.oprCountryRank, state: teamRankings.oprStateRank },
                              { label: "Auto", world: teamRankings.autoOprWorldRank, worldTotal: teamRankings.oprWorldTotal, country: teamRankings.autoOprCountryRank, state: teamRankings.autoOprStateRank },
                              { label: "Teleop", world: teamRankings.teleopOprWorldRank, worldTotal: teamRankings.oprWorldTotal, country: teamRankings.teleopOprCountryRank, state: teamRankings.teleopOprStateRank },
                              { label: "Endgame", world: teamRankings.endgameOprWorldRank, worldTotal: teamRankings.oprWorldTotal, country: teamRankings.endgameOprCountryRank, state: teamRankings.endgameOprStateRank },
                            ].map((row) => (
                              <tr key={row.label}>
                                <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-300">{row.label}</td>
                                <td className="py-1.5 px-2 text-center font-mono text-blue-600 dark:text-blue-400">
                                  {row.world !== null ? (
                                    <>#{row.world} <span className="text-gray-400 font-sans">/ {row.worldTotal}</span></>
                                  ) : "-"}
                                </td>
                                {teamRankings.oprCountryRank !== null && teamRankings.country && (
                                  <td className="py-1.5 px-2 text-center font-mono text-blue-600 dark:text-blue-400">
                                    {row.country !== null ? (
                                      <>#{row.country}</>
                                    ) : "-"}
                                  </td>
                                )}
                                {teamRankings.oprStateRank !== null && teamRankings.stateProv && (
                                  <td className="py-1.5 px-2 text-center font-mono text-green-600 dark:text-green-400">
                                    {row.state !== null ? (
                                      <>#{row.state}</>
                                    ) : "-"}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      ) : eventSummaries.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No events found for this team
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Seasonal Performance Charts */}
          <SeasonalPerformance data={seasonalData} loading={seasonalLoading} />

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Past Events
              </h2>
              {pastEvents.map((event) => (
                <EventCard
                  key={event.eventCode}
                  event={event}
                  isExpanded={expandedEvent === event.eventCode}
                  isLoading={detailLoading === event.eventCode}
                  detail={eventDetails[event.eventCode] || null}
                  teamNumber={teamNumber}
                  onToggle={() => handleExpandEvent(event.eventCode)}
                />
              ))}
            </div>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6">
                Upcoming
              </h2>
              {upcomingEvents.map((event) => (
                <div
                  key={event.eventCode}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 opacity-70"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{event.eventName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {[event.city, event.stateProv]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(event.dateStart).toLocaleDateString()}
                      </p>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full">
                        Upcoming
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-4 mt-6">
            <Link
              href={`/scout?teamNumber=${teamNumber}`}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium text-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Scout This Team
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultBadge({ result }: { result: "win" | "loss" | "tie" }) {
  const styles = {
    win: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    loss: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    tie: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };
  const labels = { win: "W", loss: "L", tie: "T" };

  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${styles[result]}`}
    >
      {labels[result]}
    </span>
  );
}

function MatchHistory({
  matches,
  teamNumber,
}: {
  matches: TeamMatchBreakdown[];
  teamNumber: number;
}) {
  const qualMatches = matches.filter((m) => m.level === "qual");
  const playoffMatches = matches.filter((m) => m.level === "playoff");
  const matchKey = (m: TeamMatchBreakdown) =>
    `${m.level}-${m.matchNumber}-${m.matchSeries}`;
  const matchLabel = (m: TeamMatchBreakdown) =>
    m.level === "qual" ? `Q${m.matchNumber}` : `P${m.matchSeries}`;

  const renderMobileCard = (m: TeamMatchBreakdown) => (
    <div
      key={matchKey(m)}
      className={`bg-white dark:bg-gray-900 rounded-lg p-3 border-l-4 ${
        m.alliance === "red" ? "border-red-500" : "border-blue-500"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400" title={m.description}>
            {matchLabel(m)}
          </span>
          <ResultBadge result={m.result} />
        </div>
        <div className="text-right">
          <span className="font-mono font-bold text-lg">
            {m.allianceScore}
          </span>
          <span className="text-gray-400 mx-1">-</span>
          <span className="font-mono text-gray-500">
            {m.opponentScore}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
        <div>
          Partner:{" "}
          <Link
            href={`/analytics/team/${m.partnerTeam}`}
            className="text-ftc-blue hover:underline font-medium"
          >
            {m.partnerTeam}
          </Link>
        </div>
        <div>
          vs{" "}
          <Link
            href={`/analytics/team/${m.opponentTeam1}`}
            className="text-ftc-blue hover:underline font-medium"
          >
            {m.opponentTeam1}
          </Link>
          {" & "}
          <Link
            href={`/analytics/team/${m.opponentTeam2}`}
            className="text-ftc-blue hover:underline font-medium"
          >
            {m.opponentTeam2}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
          <p className="font-mono font-semibold">{m.allianceAutoScore}</p>
          <p className="text-gray-500">Auto</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
          <p className="font-mono font-semibold">{m.allianceTeleopScore}</p>
          <p className="text-gray-500">Teleop</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
          <p className="font-mono font-semibold">{m.allianceEndgameScore}</p>
          <p className="text-gray-500">Endgame</p>
        </div>
      </div>
    </div>
  );

  const renderTableRow = (m: TeamMatchBreakdown) => (
    <tr key={matchKey(m)} className="hover:bg-gray-100/50 dark:hover:bg-gray-700/30">
      <td className="py-2 font-medium" title={m.description}>{matchLabel(m)}</td>
      <td className="py-2">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              m.alliance === "red" ? "bg-red-500" : "bg-blue-500"
            }`}
          />
          <span className="capitalize">{m.alliance}</span>
        </span>
      </td>
      <td className="py-2">
        <Link
          href={`/analytics/team/${m.partnerTeam}`}
          className="text-ftc-blue hover:underline"
        >
          {m.partnerTeam}
        </Link>
      </td>
      <td className="py-2">
        <Link
          href={`/analytics/team/${m.opponentTeam1}`}
          className="text-ftc-blue hover:underline"
        >
          {m.opponentTeam1}
        </Link>
        {", "}
        <Link
          href={`/analytics/team/${m.opponentTeam2}`}
          className="text-ftc-blue hover:underline"
        >
          {m.opponentTeam2}
        </Link>
      </td>
      <td className="py-2 text-right font-mono">{m.allianceAutoScore}</td>
      <td className="py-2 text-right font-mono">{m.allianceTeleopScore}</td>
      <td className="py-2 text-right font-mono">{m.allianceEndgameScore}</td>
      <td className="py-2 text-right font-mono font-bold">{m.allianceScore}</td>
      <td className="py-2 text-right font-mono text-gray-500">{m.opponentScore}</td>
      <td className="py-2 text-center">
        <ResultBadge result={m.result} />
      </td>
    </tr>
  );

  const renderSectionDivider = (label: string) => (
    <tr>
      <td
        colSpan={10}
        className="pt-4 pb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
      >
        {label}
      </td>
    </tr>
  );

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
        Match Results ({matches.length} matches)
      </h3>

      {/* Mobile layout */}
      <div className="md:hidden space-y-2">
        {qualMatches.length > 0 && playoffMatches.length > 0 && (
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Qualifications
          </p>
        )}
        {qualMatches.map(renderMobileCard)}
        {playoffMatches.length > 0 && (
          <>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide pt-2">
              Playoffs
            </p>
            {playoffMatches.map(renderMobileCard)}
          </>
        )}
      </div>

      {/* Desktop table layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 font-medium">Match</th>
              <th className="pb-2 font-medium">Alliance</th>
              <th className="pb-2 font-medium">Partner</th>
              <th className="pb-2 font-medium">Opponents</th>
              <th className="pb-2 font-medium text-right">Auto</th>
              <th className="pb-2 font-medium text-right">Teleop</th>
              <th className="pb-2 font-medium text-right">End</th>
              <th className="pb-2 font-medium text-right">Total</th>
              <th className="pb-2 font-medium text-right">Opp</th>
              <th className="pb-2 font-medium text-center">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {qualMatches.length > 0 && playoffMatches.length > 0 && renderSectionDivider("Qualifications")}
            {qualMatches.map(renderTableRow)}
            {playoffMatches.length > 0 && renderSectionDivider("Playoffs")}
            {playoffMatches.map(renderTableRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventCard({
  event,
  isExpanded,
  isLoading,
  detail,
  teamNumber,
  onToggle,
}: {
  event: EventSummary;
  isExpanded: boolean;
  isLoading: boolean;
  detail: EventDetail | null;
  teamNumber: number;
  onToggle: () => void;
}) {
  const hasRankData = event.rank !== null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Summary row — always visible */}
      <div className="w-full p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <Link
              href={`/analytics/team/${teamNumber}/event/${event.eventCode}`}
              className="font-medium truncate hover:underline text-ftc-orange"
              onClick={(e) => e.stopPropagation()}
            >
              {event.eventName}
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {[event.city, event.stateProv].filter(Boolean).join(", ")} &middot;{" "}
              {new Date(event.dateStart).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-3 ml-4 shrink-0">
            {/* Performance snippet */}
            {hasRankData && (
              <div className="flex items-center gap-3 text-sm">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${
                    event.rank! <= 3
                      ? "bg-ftc-orange"
                      : event.rank! <= 8
                      ? "bg-ftc-blue"
                      : "bg-gray-400 dark:bg-gray-600"
                  }`}
                >
                  {event.rank}
                </span>
                <span className="font-mono text-gray-600 dark:text-gray-300">
                  {event.wins}-{event.losses}-{event.ties}
                </span>
                {event.qualAverage !== null && (
                  <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">
                    {event.qualAverage.toFixed(1)} avg
                  </span>
                )}
              </div>
            )}

            {/* Chevron */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={isExpanded ? "Collapse event details" : "Expand event details"}
            >
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-ftc-orange border-t-transparent" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* EPA & OPR side by side */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* EPA */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    EPA
                  </h3>
                  {detail.epa ? (
                    <div className="space-y-2">
                      <p className="text-2xl font-bold">
                        <span
                          className={
                            detail.epa.epa >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          }
                        >
                          {detail.epa.epa >= 0 ? "+" : ""}
                          {detail.epa.epa.toFixed(1)}
                        </span>
                      </p>
                      <div className="grid grid-cols-3 gap-1 text-center text-xs">
                        <div>
                          <p className="font-semibold">
                            {detail.epa.autoEpa >= 0 ? "+" : ""}
                            {detail.epa.autoEpa.toFixed(1)}
                          </p>
                          <p className="text-gray-500">Auto</p>
                        </div>
                        <div>
                          <p className="font-semibold">
                            {detail.epa.teleopEpa >= 0 ? "+" : ""}
                            {detail.epa.teleopEpa.toFixed(1)}
                          </p>
                          <p className="text-gray-500">Teleop</p>
                        </div>
                        <div>
                          <p className="font-semibold">
                            {detail.epa.endgameEpa >= 0 ? "+" : ""}
                            {detail.epa.endgameEpa.toFixed(1)}
                          </p>
                          <p className="text-gray-500">Endgame</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        {detail.epa.matchCount} matches
                        {detail.epa.trend && (
                          <span className="ml-1">
                            {detail.epa.trend === "up" && (
                              <span className="text-green-500">&#8593;</span>
                            )}
                            {detail.epa.trend === "down" && (
                              <span className="text-red-500">&#8595;</span>
                            )}
                            {detail.epa.trend === "stable" && (
                              <span className="text-gray-400">&#8594;</span>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No EPA data</p>
                  )}
                </div>

                {/* OPR */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    OPR
                  </h3>
                  {detail.opr ? (
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-ftc-blue">
                        {detail.opr.opr.toFixed(1)}
                      </p>
                      <div className="grid grid-cols-3 gap-1 text-center text-xs">
                        <div>
                          <p className="font-semibold">
                            {detail.opr.autoOpr?.toFixed(1) || "-"}
                          </p>
                          <p className="text-gray-500">Auto</p>
                        </div>
                        <div>
                          <p className="font-semibold">
                            {detail.opr.teleopOpr?.toFixed(1) || "-"}
                          </p>
                          <p className="text-gray-500">Teleop</p>
                        </div>
                        <div>
                          <p className="font-semibold">
                            {detail.opr.endgameOpr?.toFixed(1) || "-"}
                          </p>
                          <p className="text-gray-500">Endgame</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-center text-xs">
                        <div>
                          <p className="font-semibold">
                            {detail.opr.dpr?.toFixed(1) || "-"}
                          </p>
                          <p className="text-gray-500">DPR</p>
                        </div>
                        <div>
                          <p
                            className={`font-semibold ${
                              (detail.opr.ccwm || 0) >= 0
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {(detail.opr.ccwm || 0) >= 0 ? "+" : ""}
                            {detail.opr.ccwm?.toFixed(1) || "-"}
                          </p>
                          <p className="text-gray-500">CCWM</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No OPR data</p>
                  )}
                </div>
              </div>

              {/* Scouting averages */}
              {detail.scouting?.averages && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    Scouting Averages ({detail.scouting.matchCount} entries)
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">
                        Autonomous
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Leave Rate</span>
                          <span className="font-medium">
                            {Math.round(
                              detail.scouting.averages.autoLeaveRate * 100
                            )}
                            %
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Classified</span>
                          <span className="font-medium">
                            {detail.scouting.averages.autoClassified.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Overflow</span>
                          <span className="font-medium">
                            {detail.scouting.averages.autoOverflow.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                          <span className="font-medium">Avg</span>
                          <span className="font-bold text-ftc-orange">
                            {detail.scouting.averages.autoScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">
                        Teleop
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Classified</span>
                          <span className="font-medium">
                            {detail.scouting.averages.teleopClassified.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Overflow</span>
                          <span className="font-medium">
                            {detail.scouting.averages.teleopOverflow.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Depot</span>
                          <span className="font-medium">
                            {detail.scouting.averages.teleopDepot.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                          <span className="font-medium">Avg</span>
                          <span className="font-bold text-ftc-blue">
                            {detail.scouting.averages.teleopScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">
                        Endgame &amp; Total
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Endgame Avg</span>
                          <span className="font-medium">
                            {detail.scouting.averages.endgameScore.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
                          <span className="font-bold">Total Avg</span>
                          <span className="font-bold text-green-500 text-lg">
                            {detail.scouting.averages.totalScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Match Results */}
              {detail.matches && detail.matches.length > 0 && (
                <MatchHistory matches={detail.matches} teamNumber={teamNumber} />
              )}

              {/* Quick action links */}
              <div className="flex gap-3">
                <Link
                  href={`/analytics/predict?event=${event.eventCode}`}
                  className="flex-1 py-2.5 bg-ftc-orange text-white rounded-lg font-medium text-center text-sm hover:opacity-90 transition-opacity"
                >
                  Predict Match
                </Link>
                <Link
                  href={`/scout?teamNumber=${teamNumber}&event=${event.eventCode}`}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium text-center text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Scout This Team
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              No detail data available
            </p>
          )}
        </div>
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
