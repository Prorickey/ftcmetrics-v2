"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  analyticsApi,
  scoutingApi,
  ftcTeamsApi,
  eventsApi,
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

interface EventInfo {
  code: string;
  name: string;
  city?: string;
  stateprov?: string;
  country?: string;
  dateStart?: string;
  dateEnd?: string;
}

interface ScoutingNote {
  id: string;
  aboutTeamNumber: number;
  eventCode?: string;
  reliabilityRating?: number;
  driverSkillRating?: number;
  defenseRating?: number;
  strategyNotes?: string;
  mechanicalNotes?: string;
  generalNotes?: string;
  createdAt: string;
  author?: {
    name: string;
  };
}

interface ScoutingEntry {
  id: string;
  eventCode: string;
  matchNumber: number;
  alliance: "RED" | "BLUE";
  autoLeave: boolean;
  autoClassifiedCount: number;
  autoOverflowCount: number;
  autoPatternCount: number;
  teleopClassifiedCount: number;
  teleopOverflowCount: number;
  teleopDepotCount: number;
  teleopPatternCount: number;
  teleopMotifCount: number;
  endgameBaseStatus: "NONE" | "PARTIAL" | "FULL";
  autoScore: number;
  teleopScore: number;
  endgameScore: number;
  totalScore: number;
  allianceNotes?: string;
  createdAt: string;
  scoutedTeam: {
    id: string;
    teamNumber: number;
    name: string;
  };
  scouter: {
    id: string;
    name: string;
    image: string | null;
  };
}

interface ScoutingAverages {
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
          <span
            className="text-sm font-medium text-gray-500 dark:text-gray-400"
            title={m.description}
          >
            {matchLabel(m)}
          </span>
          <ResultBadge result={m.result} />
        </div>
        <div className="text-right">
          <span className="font-mono font-bold text-lg">
            {m.allianceScore}
          </span>
          <span className="text-gray-400 mx-1">-</span>
          <span className="font-mono text-gray-500">{m.opponentScore}</span>
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
    <tr
      key={matchKey(m)}
      className="hover:bg-gray-100/50 dark:hover:bg-gray-700/30"
    >
      <td className="py-2 font-medium" title={m.description}>
        {matchLabel(m)}
      </td>
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
      <td className="py-2 text-right font-mono font-bold">
        {m.allianceScore}
      </td>
      <td className="py-2 text-right font-mono text-gray-500">
        {m.opponentScore}
      </td>
      <td className="py-2 text-center">
        <ResultBadge result={m.result} />
      </td>
    </tr>
  );

  const renderSectionDivider = (label: string) => (
    <tr key={`divider-${label}`}>
      <td
        colSpan={10}
        className="pt-4 pb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
      >
        {label}
      </td>
    </tr>
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold mb-4">
        Match Results ({matches.length} matches)
      </h2>

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
            {qualMatches.length > 0 &&
              playoffMatches.length > 0 &&
              renderSectionDivider("Qualifications")}
            {qualMatches.map(renderTableRow)}
            {playoffMatches.length > 0 && renderSectionDivider("Playoffs")}
            {playoffMatches.map(renderTableRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type NoteCardItem =
  | { type: "note"; data: ScoutingNote }
  | { type: "entry"; data: ScoutingEntry };

function NotesSection({
  notes,
  entries,
}: {
  notes: ScoutingNote[];
  entries: ScoutingEntry[];
}) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = useCallback((id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Combine notes and entries with alliance notes, sorted by creation date
  const entriesWithNotes = entries.filter((e) => e.allianceNotes);
  const combined: NoteCardItem[] = [
    ...notes.map((n) => ({ type: "note" as const, data: n })),
    ...entriesWithNotes.map((e) => ({ type: "entry" as const, data: e })),
  ].sort(
    (a, b) =>
      new Date(b.data.createdAt).getTime() -
      new Date(a.data.createdAt).getTime()
  );

  if (combined.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold mb-4">
          Team Notes & Observations
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
          No notes or observations recorded for this team at this event
        </p>
      </div>
    );
  }

  const getRatingSummary = (note: ScoutingNote) => {
    const ratings: string[] = [];
    if (note.reliabilityRating)
      ratings.push(`Reliability: ${note.reliabilityRating}/5`);
    if (note.driverSkillRating)
      ratings.push(`Driver: ${note.driverSkillRating}/5`);
    if (note.defenseRating) ratings.push(`Defense: ${note.defenseRating}/5`);
    return ratings;
  };

  const getFirstNoteLine = (note: ScoutingNote) => {
    const text =
      note.generalNotes || note.strategyNotes || note.mechanicalNotes;
    if (!text) return null;
    const firstLine = text.split("\n")[0];
    return firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold mb-4">
        Team Notes & Observations ({combined.length})
      </h2>
      <div className="space-y-2">
        {combined.map((item) => {
          const cardId =
            item.type === "note"
              ? `note-${item.data.id}`
              : `entry-${item.data.id}`;
          const isExpanded = expandedCards.has(cardId);

          if (item.type === "note") {
            const note = item.data;
            const ratings = getRatingSummary(note);
            const preview = getFirstNoteLine(note);

            return (
              <button
                key={cardId}
                onClick={() => toggleCard(cardId)}
                className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50"
              >
                {/* Collapsed header */}
                <div className="p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full font-medium">
                        Note
                      </span>
                      {ratings.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {ratings.join(" | ")}
                        </span>
                      )}
                    </div>
                    {!isExpanded && preview && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {preview}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
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

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
                    {/* Ratings */}
                    {ratings.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {note.reliabilityRating && (
                          <div className="bg-white dark:bg-gray-900 rounded px-2 py-1.5">
                            <p className="font-semibold">
                              {note.reliabilityRating}/5
                            </p>
                            <p className="text-gray-500">Reliability</p>
                          </div>
                        )}
                        {note.driverSkillRating && (
                          <div className="bg-white dark:bg-gray-900 rounded px-2 py-1.5">
                            <p className="font-semibold">
                              {note.driverSkillRating}/5
                            </p>
                            <p className="text-gray-500">Driver Skill</p>
                          </div>
                        )}
                        {note.defenseRating && (
                          <div className="bg-white dark:bg-gray-900 rounded px-2 py-1.5">
                            <p className="font-semibold">
                              {note.defenseRating}/5
                            </p>
                            <p className="text-gray-500">Defense</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes content */}
                    {note.strategyNotes && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Strategy
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {note.strategyNotes}
                        </p>
                      </div>
                    )}
                    {note.mechanicalNotes && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Mechanical
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {note.mechanicalNotes}
                        </p>
                      </div>
                    )}
                    {note.generalNotes && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          General
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {note.generalNotes}
                        </p>
                      </div>
                    )}

                    {note.author && (
                      <p className="text-xs text-gray-400 text-right">
                        by {note.author.name}
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          }

          // Match entry card
          const entry = item.data;
          const allianceColor =
            entry.alliance === "BLUE"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
          const notesPreview = entry.allianceNotes
            ? entry.allianceNotes.length > 80
              ? entry.allianceNotes.slice(0, 80) + "..."
              : entry.allianceNotes
            : "";

          return (
            <button
              key={cardId}
              onClick={() => toggleCard(cardId)}
              className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50"
            >
              {/* Collapsed header */}
              <div className="p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${allianceColor}`}
                    >
                      Match {entry.matchNumber}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.totalScore} pts
                    </span>
                  </div>
                  {!isExpanded && notesPreview && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {notesPreview}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${
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

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
                  {/* Match scoring breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white dark:bg-gray-900 rounded px-2 py-1.5">
                      <p className="font-mono font-semibold">
                        {entry.autoScore}
                      </p>
                      <p className="text-gray-500">Auto</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded px-2 py-1.5">
                      <p className="font-mono font-semibold">
                        {entry.teleopScore}
                      </p>
                      <p className="text-gray-500">Teleop</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded px-2 py-1.5">
                      <p className="font-mono font-semibold">
                        {entry.endgameScore}
                      </p>
                      <p className="text-gray-500">Endgame</p>
                    </div>
                  </div>

                  {/* Detailed counts */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Auto Leave</span>
                      <span className="font-medium">
                        {entry.autoLeave ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Endgame Base</span>
                      <span className="font-medium capitalize">
                        {entry.endgameBaseStatus.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Auto Classified</span>
                      <span className="font-medium">
                        {entry.autoClassifiedCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Auto Overflow</span>
                      <span className="font-medium">
                        {entry.autoOverflowCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Teleop Classified</span>
                      <span className="font-medium">
                        {entry.teleopClassifiedCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Teleop Overflow</span>
                      <span className="font-medium">
                        {entry.teleopOverflowCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Teleop Depot</span>
                      <span className="font-medium">
                        {entry.teleopDepotCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Teleop Patterns</span>
                      <span className="font-medium">
                        {entry.teleopPatternCount}
                      </span>
                    </div>
                  </div>

                  {/* Alliance notes */}
                  {entry.allianceNotes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Alliance Notes
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {entry.allianceNotes}
                      </p>
                    </div>
                  )}

                  {entry.scouter && (
                    <p className="text-xs text-gray-400 text-right">
                      by {entry.scouter.name}
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamEventAnalyticsContent() {
  const params = useParams();
  const { data: session } = useSession();
  const teamNumber = parseInt(params.teamNumber as string, 10);
  const eventCode = params.eventCode as string;

  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [opr, setOpr] = useState<OPRResult | null>(null);
  const [epa, setEpa] = useState<EPAResult | null>(null);
  const [scouting, setScouting] = useState<{
    matchCount: number;
    averages: ScoutingAverages | null;
  } | null>(null);
  const [matches, setMatches] = useState<TeamMatchBreakdown[] | null>(null);
  const [notes, setNotes] = useState<ScoutingNote[]>([]);
  const [entries, setEntries] = useState<ScoutingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch all data in parallel
        const [
          teamResult,
          eventResult,
          analyticsResult,
          scoutingResult,
          matchesResult,
          notesResult,
        ] = await Promise.all([
          ftcTeamsApi.getTeam(teamNumber),
          eventsApi.getEvent(eventCode),
          analyticsApi.getTeamAnalytics(teamNumber, eventCode),
          scoutingApi.getTeamSummary(teamNumber, eventCode),
          analyticsApi.getTeamMatches(teamNumber, eventCode),
          session?.user?.id
            ? scoutingApi.getNotes(session.user.id, {
                aboutTeamNumber: teamNumber,
                eventCode,
              })
            : Promise.resolve({ success: true, data: [] }),
        ]);

        if (teamResult.success && teamResult.data) {
          setTeamInfo(teamResult.data);
        }
        if (eventResult.success && eventResult.data) {
          setEventInfo(eventResult.data as EventInfo);
        }
        if (analyticsResult.success && analyticsResult.data) {
          setOpr(analyticsResult.data.opr ?? null);
          setEpa(analyticsResult.data.epa ?? null);
        }
        if (scoutingResult.success && scoutingResult.data) {
          setScouting(scoutingResult.data);
        }
        if (matchesResult.success && matchesResult.data) {
          setMatches(matchesResult.data.matches ?? null);
        }
        if (notesResult.success && notesResult.data) {
          setNotes(notesResult.data as ScoutingNote[]);
        }
      } catch (err) {
        console.error("Failed to fetch team event data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [teamNumber, eventCode, session?.user?.id]);

  // Fetch scouting entries when session is available
  useEffect(() => {
    async function fetchEntries() {
      if (!session?.user?.id) return;
      try {
        const entriesResult = await scoutingApi.getEntries(session.user.id, {
          eventCode,
          teamNumber,
        });
        if (entriesResult.success && entriesResult.data) {
          setEntries(entriesResult.data as ScoutingEntry[]);
        }
      } catch (err) {
        console.error("Failed to fetch scouting entries:", err);
      }
    }
    fetchEntries();
  }, [session?.user?.id, teamNumber, eventCode]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/analytics/team/${teamNumber}`}
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
          Back to Team {teamNumber}
        </Link>

        {loading ? (
          <div className="space-y-2">
            <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse w-2/3" />
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-ftc-orange">
                {teamNumber}
              </span>
              <h1 className="text-2xl font-bold">
                {teamInfo?.nameShort || teamInfo?.nameFull || `Team ${teamNumber}`}
              </h1>
            </div>
            {eventInfo && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {eventInfo.name}
              </p>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* EPA & OPR side by side */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* EPA */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                EPA (Expected Points Added)
              </h2>
              {epa ? (
                <div className="space-y-3">
                  <p className="text-3xl font-bold">
                    <span
                      className={
                        epa.epa >= 0 ? "text-green-500" : "text-red-500"
                      }
                    >
                      {epa.epa >= 0 ? "+" : ""}
                      {epa.epa.toFixed(1)}
                    </span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
                      <p className="font-semibold">
                        {epa.autoEpa >= 0 ? "+" : ""}
                        {epa.autoEpa.toFixed(1)}
                      </p>
                      <p className="text-gray-500">Auto</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
                      <p className="font-semibold">
                        {epa.teleopEpa >= 0 ? "+" : ""}
                        {epa.teleopEpa.toFixed(1)}
                      </p>
                      <p className="text-gray-500">Teleop</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
                      <p className="font-semibold">
                        {epa.endgameEpa >= 0 ? "+" : ""}
                        {epa.endgameEpa.toFixed(1)}
                      </p>
                      <p className="text-gray-500">Endgame</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    {epa.matchCount} matches
                    {epa.trend && (
                      <span className="ml-1">
                        {epa.trend === "up" && (
                          <span className="text-green-500">&#8593;</span>
                        )}
                        {epa.trend === "down" && (
                          <span className="text-red-500">&#8595;</span>
                        )}
                        {epa.trend === "stable" && (
                          <span className="text-gray-400">&#8594;</span>
                        )}
                      </span>
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No EPA data available</p>
              )}
            </div>

            {/* OPR */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                OPR (Offensive Power Rating)
              </h2>
              {opr ? (
                <div className="space-y-3">
                  <p className="text-3xl font-bold text-ftc-blue">
                    {opr.opr.toFixed(1)}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
                      <p className="font-semibold">
                        {opr.autoOpr?.toFixed(1) || "-"}
                      </p>
                      <p className="text-gray-500">Auto</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
                      <p className="font-semibold">
                        {opr.teleopOpr?.toFixed(1) || "-"}
                      </p>
                      <p className="text-gray-500">Teleop</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
                      <p className="font-semibold">
                        {opr.endgameOpr?.toFixed(1) || "-"}
                      </p>
                      <p className="text-gray-500">Endgame</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
                      <p className="font-semibold">
                        {opr.dpr?.toFixed(1) || "-"}
                      </p>
                      <p className="text-gray-500">DPR</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
                      <p
                        className={`font-semibold ${
                          (opr.ccwm || 0) >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {(opr.ccwm || 0) >= 0 ? "+" : ""}
                        {opr.ccwm?.toFixed(1) || "-"}
                      </p>
                      <p className="text-gray-500">CCWM</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No OPR data available</p>
              )}
            </div>
          </div>

          {/* Scouting Averages */}
          {scouting?.averages && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-4">
                Scouting Averages ({scouting.matchCount} entries)
              </h2>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <h3 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                    Autonomous
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Leave Rate</span>
                      <span className="font-medium">
                        {Math.round(scouting.averages.autoLeaveRate * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Classified</span>
                      <span className="font-medium">
                        {scouting.averages.autoClassified.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overflow</span>
                      <span className="font-medium">
                        {scouting.averages.autoOverflow.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-medium">Avg</span>
                      <span className="font-bold text-ftc-orange">
                        {scouting.averages.autoScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                    Teleop
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Classified</span>
                      <span className="font-medium">
                        {scouting.averages.teleopClassified.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overflow</span>
                      <span className="font-medium">
                        {scouting.averages.teleopOverflow.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Depot</span>
                      <span className="font-medium">
                        {scouting.averages.teleopDepot.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-medium">Avg</span>
                      <span className="font-bold text-ftc-blue">
                        {scouting.averages.teleopScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                    Endgame & Total
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Endgame Avg</span>
                      <span className="font-medium">
                        {scouting.averages.endgameScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
                      <span className="font-bold">Total Avg</span>
                      <span className="font-bold text-green-500 text-lg">
                        {scouting.averages.totalScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Match Results */}
          {matches && matches.length > 0 && (
            <MatchHistory matches={matches} teamNumber={teamNumber} />
          )}

          {/* Notes & Observations */}
          <NotesSection notes={notes} entries={entries} />

          {/* Quick Actions */}
          <div className="flex gap-4">
            <Link
              href={`/analytics/predict?event=${eventCode}`}
              className="flex-1 py-3 bg-ftc-orange text-white rounded-lg font-medium text-center hover:opacity-90 transition-opacity"
            >
              Predict Match
            </Link>
            <Link
              href={`/scout?teamNumber=${teamNumber}&event=${eventCode}`}
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

export default function TeamEventAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      }
    >
      <TeamEventAnalyticsContent />
    </Suspense>
  );
}
