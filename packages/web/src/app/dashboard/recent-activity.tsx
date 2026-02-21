"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { teamsApi, scoutingApi } from "@/lib/api";

interface ScoutingEntry {
  id: string;
  scoutedTeamId: string;
  scoutedTeam?: {
    teamNumber: number;
    name: string;
  };
  eventCode: string;
  matchNumber: number;
  alliance: string;
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
  allianceNotes: string | null;
  autoScore: number;
  teleopScore: number;
  endgameScore: number;
  totalScore: number;
  createdAt: string;
  scouter: {
    id: string;
    name: string;
    image: string | null;
  };
}

interface ScoutingNote {
  id: string;
  eventCode: string | null;
  reliabilityRating: number | null;
  driverSkillRating: number | null;
  defenseRating: number | null;
  strategyNotes: string | null;
  mechanicalNotes: string | null;
  generalNotes: string | null;
  createdAt: string;
  aboutTeam: {
    id: string;
    teamNumber: number;
    name: string;
  };
  author: {
    id: string;
    name: string;
    image: string | null;
  };
}

type FeedItem =
  | { type: "entry"; data: ScoutingEntry }
  | { type: "note"; data: ScoutingNote };

interface UserTeam {
  teamId: string;
  team: {
    teamNumber: number;
    name: string;
  };
}

export function RecentActivity() {
  const { data: session } = useSession();
  const [entries, setEntries] = useState<ScoutingEntry[]>([]);
  const [notes, setNotes] = useState<ScoutingNote[]>([]);
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalEntries: 0,
    totalTeams: 0,
    totalEvents: 0,
  });

  useEffect(() => {
    async function fetchData() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      try {
        // First fetch user's teams
        const teamsResult = await teamsApi.getMyTeams(session.user.id);
        if (teamsResult.success && teamsResult.data) {
          setTeams(teamsResult.data);

          // Fetch scouting entries and notes for all teams in parallel
          const allEntries: ScoutingEntry[] = [];
          const allNotes: ScoutingNote[] = [];
          const eventCodes = new Set<string>();

          const fetchPromises = teamsResult.data.flatMap(({ teamId }) => [
            scoutingApi.getEntries(session.user!.id, {
              scoutingTeamId: teamId,
            }).then((result) => {
              if (result.success && result.data) {
                const teamEntries = result.data as ScoutingEntry[];
                allEntries.push(...teamEntries);
                teamEntries.forEach((e) => eventCodes.add(e.eventCode));
              }
            }),
            scoutingApi.getNotes(session.user!.id, { notingTeamId: teamId }).then((result) => {
              if (result.success && result.data) {
                allNotes.push(...(result.data as ScoutingNote[]));
              }
            }),
          ]);

          await Promise.all(fetchPromises);

          // Sort by date and take most recent
          allEntries.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setEntries(allEntries.slice(0, 20));

          // Sort notes and take most recent
          allNotes.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setNotes(allNotes.slice(0, 10));

          // Calculate stats
          const uniqueTeams = new Set(allEntries.map((e) => e.scoutedTeam?.teamNumber));
          setStats({
            totalEntries: allEntries.length,
            totalTeams: uniqueTeams.size,
            totalEvents: eventCodes.size,
          });
        }
      } catch (err) {
        console.error("Failed to fetch activity:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold text-lg mb-4">Recent Activity</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold text-lg mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-50"
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
          <p>Join a team to start scouting</p>
          <Link
            href="/my-teams"
            className="mt-4 inline-block px-4 py-2 bg-ftc-orange text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            Join or Create Team
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-ftc-orange">{stats.totalEntries}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Entries Scouted</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-ftc-blue">{stats.totalTeams}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Teams Scouted</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{stats.totalEvents}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Events</p>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Recent Activity</h2>
          <Link
            href="/scout"
            className="text-sm text-ftc-orange hover:underline"
          >
            Scout More
          </Link>
        </div>

        {entries.length === 0 && notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-3 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p>No scouting entries yet</p>
            <p className="text-sm mt-1">Start scouting matches to see activity here</p>
            <Link
              href="/scout"
              className="mt-4 inline-block px-4 py-2 bg-ftc-orange text-white rounded-lg text-sm font-medium hover:opacity-90"
            >
              Start Scouting
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Merge entries and notes into a chronological feed */}
            {((): FeedItem[] => {
              const items: FeedItem[] = [
                ...entries.map((e) => ({ type: "entry" as const, data: e })),
                ...notes.map((n) => ({ type: "note" as const, data: n })),
              ];
              items.sort(
                (a, b) =>
                  new Date(b.data.createdAt).getTime() -
                  new Date(a.data.createdAt).getTime()
              );
              return items.slice(0, 15);
            })().map((item) => {
              if (item.type === "entry") {
                const entry = item.data;
                const isExpanded = expandedItemId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    onClick={() => setExpandedItemId(isExpanded ? null : entry.id)}
                  >
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-8 rounded-full flex-shrink-0 ${
                            entry.alliance === "RED" ? "bg-red-500" : "bg-blue-500"
                          }`}
                        />
                        <div>
                          <Link
                            href={`/analytics/team/${entry.scoutedTeam?.teamNumber}`}
                            className="font-medium hover:text-ftc-orange"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Team {entry.scoutedTeam?.teamNumber}
                          </Link>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Match {entry.matchNumber} at {entry.eventCode}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-lg">{entry.totalScore}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded scoring breakdown */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3 mx-3">
                        {/* Autonomous */}
                        <div>
                          <p className="text-xs font-semibold text-ftc-orange uppercase tracking-wide mb-1.5">Autonomous — {entry.autoScore} pts</p>
                          <div className="grid grid-cols-2 gap-1.5 text-sm">
                            <div className="flex justify-between bg-white dark:bg-gray-900 rounded px-2.5 py-1">
                              <span className="text-gray-500 dark:text-gray-400">Leave</span>
                              <span className="font-medium">{entry.autoLeave ? "Yes (3)" : "No (0)"}</span>
                            </div>
                            <div className="flex justify-between bg-white dark:bg-gray-900 rounded px-2.5 py-1">
                              <span className="text-gray-500 dark:text-gray-400">Classified</span>
                              <span className="font-medium">{entry.autoClassifiedCount} ({entry.autoClassifiedCount * 3})</span>
                            </div>
                            <div className="flex justify-between bg-white dark:bg-gray-900 rounded px-2.5 py-1">
                              <span className="text-gray-500 dark:text-gray-400">Overflow</span>
                              <span className="font-medium">{entry.autoOverflowCount} ({entry.autoOverflowCount})</span>
                            </div>
                            <div className="flex justify-between bg-white dark:bg-gray-900 rounded px-2.5 py-1">
                              <span className="text-gray-500 dark:text-gray-400">Pattern</span>
                              <span className="font-medium">{entry.autoPatternCount} ({entry.autoPatternCount * 2})</span>
                            </div>
                          </div>
                        </div>

                        {/* Teleop */}
                        <div>
                          <p className="text-xs font-semibold text-ftc-blue uppercase tracking-wide mb-1.5">Teleop — {entry.teleopScore} pts</p>
                          <div className="grid grid-cols-2 gap-1.5 text-sm">
                            <div className="flex justify-between bg-white dark:bg-gray-900 rounded px-2.5 py-1">
                              <span className="text-gray-500 dark:text-gray-400">Classified</span>
                              <span className="font-medium">{entry.teleopClassifiedCount} ({entry.teleopClassifiedCount * 3})</span>
                            </div>
                            <div className="flex justify-between bg-white dark:bg-gray-900 rounded px-2.5 py-1">
                              <span className="text-gray-500 dark:text-gray-400">Overflow</span>
                              <span className="font-medium">{entry.teleopOverflowCount} ({entry.teleopOverflowCount})</span>
                            </div>
                            <div className="flex justify-between bg-white dark:bg-gray-900 rounded px-2.5 py-1">
                              <span className="text-gray-500 dark:text-gray-400">Depot</span>
                              <span className="font-medium">{entry.teleopDepotCount} ({entry.teleopDepotCount})</span>
                            </div>
                            <div className="flex justify-between bg-white dark:bg-gray-900 rounded px-2.5 py-1">
                              <span className="text-gray-500 dark:text-gray-400">Pattern</span>
                              <span className="font-medium">{entry.teleopPatternCount} ({entry.teleopPatternCount * 2})</span>
                            </div>
                            <div className="flex justify-between bg-white dark:bg-gray-900 rounded px-2.5 py-1">
                              <span className="text-gray-500 dark:text-gray-400">Motif</span>
                              <span className="font-medium">{entry.teleopMotifCount} ({entry.teleopMotifCount * 2})</span>
                            </div>
                          </div>
                        </div>

                        {/* Endgame */}
                        <div>
                          <p className="text-xs font-semibold text-green-500 uppercase tracking-wide mb-1.5">Endgame — {entry.endgameScore} pts</p>
                          <div className="text-sm bg-white dark:bg-gray-900 rounded px-2.5 py-1 inline-block">
                            <span className="text-gray-500 dark:text-gray-400">Base: </span>
                            <span className="font-medium">{entry.endgameBaseStatus}</span>
                          </div>
                        </div>

                        {/* Alliance Notes */}
                        {entry.allianceNotes && (
                          <div>
                            <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">Alliance Notes</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 rounded px-2.5 py-1.5">
                              {entry.allianceNotes}
                            </p>
                          </div>
                        )}

                        {/* Scouter info */}
                        <p className="text-xs text-gray-400">
                          Scouted by {entry.scouter?.name || "Unknown"}
                        </p>
                      </div>
                    )}
                  </div>
                );
              }

              // Note card
              const note = item.data;
              const isExpanded = expandedItemId === note.id;
              const previewText = note.generalNotes || note.strategyNotes || note.mechanicalNotes || "No notes";

              return (
                <div
                  key={note.id}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => setExpandedItemId(isExpanded ? null : note.id)}
                >
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      {/* Purple notebook icon */}
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-4 h-4 text-purple-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/analytics/team/${note.aboutTeam.teamNumber}`}
                          className="font-medium hover:text-purple-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Team {note.aboutTeam.teamNumber}
                        </Link>
                        {!isExpanded && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {previewText}
                          </p>
                        )}
                        {isExpanded && note.eventCode && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {note.eventCode}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </p>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-2 mx-3">
                      {/* Ratings row */}
                      {(note.reliabilityRating || note.driverSkillRating || note.defenseRating) && (
                        <div className="flex gap-3 text-xs">
                          {note.reliabilityRating && (
                            <span className="bg-white dark:bg-gray-900 rounded px-2 py-1">
                              Reliability: <strong>{note.reliabilityRating}/5</strong>
                            </span>
                          )}
                          {note.driverSkillRating && (
                            <span className="bg-white dark:bg-gray-900 rounded px-2 py-1">
                              Driver: <strong>{note.driverSkillRating}/5</strong>
                            </span>
                          )}
                          {note.defenseRating && (
                            <span className="bg-white dark:bg-gray-900 rounded px-2 py-1">
                              Defense: <strong>{note.defenseRating}/5</strong>
                            </span>
                          )}
                        </div>
                      )}
                      {note.strategyNotes && (
                        <div>
                          <p className="text-xs font-semibold text-purple-500 mb-0.5">Strategy</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{note.strategyNotes}</p>
                        </div>
                      )}
                      {note.mechanicalNotes && (
                        <div>
                          <p className="text-xs font-semibold text-purple-500 mb-0.5">Mechanical</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{note.mechanicalNotes}</p>
                        </div>
                      )}
                      {note.generalNotes && (
                        <div>
                          <p className="text-xs font-semibold text-purple-500 mb-0.5">General</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{note.generalNotes}</p>
                        </div>
                      )}
                      <p className="text-xs text-gray-400">By {note.author.name}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold text-lg mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/scout/notes"
            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <p className="font-medium">Scouting Notes</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">View team notes</p>
          </Link>
          <Link
            href="/analytics/predict"
            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <p className="font-medium">Match Predictor</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Predict outcomes</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
