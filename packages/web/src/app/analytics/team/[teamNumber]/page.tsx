"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  analyticsApi,
  ftcTeamsApi,
  scoutingApi,
  type OPRResult,
  type EPAResult,
  type TeamMatchBreakdown,
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

  // Fetch team info and event summaries in parallel
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [teamResult, summariesResult] = await Promise.all([
          ftcTeamsApi.getTeam(teamNumber),
          ftcTeamsApi.getTeamEventSummaries(teamNumber),
        ]);

        if (teamResult.success && teamResult.data) {
          setTeamInfo(teamResult.data);
        }
        if (summariesResult.success && summariesResult.data) {
          setEventSummaries(summariesResult.data);
        }
      } catch (err) {
        console.error("Failed to fetch team data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [teamNumber]);

  const handleExpandEvent = useCallback(
    async (eventCode: string) => {
      if (expandedEvent === eventCode) {
        setExpandedEvent(null);
        return;
      }

      setExpandedEvent(eventCode);

      // If we already have cached detail data, don't refetch
      if (eventDetails[eventCode]) return;

      setDetailLoading(eventCode);
      try {
        const [analyticsResult, scoutingResult, matchesResult] = await Promise.all([
          analyticsApi.getTeamAnalytics(teamNumber, eventCode),
          scoutingApi.getTeamSummary(teamNumber, eventCode),
          analyticsApi.getTeamMatches(teamNumber, eventCode),
        ]);

        setEventDetails((prev) => ({
          ...prev,
          [eventCode]: {
            opr: analyticsResult.success ? analyticsResult.data?.opr ?? null : null,
            epa: analyticsResult.success ? analyticsResult.data?.epa ?? null : null,
            scouting: scoutingResult.success ? scoutingResult.data ?? null : null,
            matches: matchesResult.success ? matchesResult.data?.matches ?? null : null,
          },
        }));
      } catch {
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
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{event.eventName}</p>
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
          </div>
        </div>
      </button>

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
