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
  totalScore: number;
  createdAt: string;
}

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
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
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

          // Then fetch scouting entries for all teams
          const allEntries: ScoutingEntry[] = [];
          const eventCodes = new Set<string>();

          for (const { teamId } of teamsResult.data) {
            const entriesResult = await scoutingApi.getEntries(session.user.id, {
              scoutingTeamId: teamId,
            });
            if (entriesResult.success && entriesResult.data) {
              const teamEntries = entriesResult.data as ScoutingEntry[];
              allEntries.push(...teamEntries);
              teamEntries.forEach((e) => eventCodes.add(e.eventCode));
            }
          }

          // Sort by date and take most recent
          allEntries.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setEntries(allEntries.slice(0, 10));

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

      {/* Recent Entries */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Recent Scouting Entries</h2>
          <Link
            href="/scout"
            className="text-sm text-ftc-orange hover:underline"
          >
            Scout More
          </Link>
        </div>

        {entries.length === 0 ? (
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
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-8 rounded-full ${
                      entry.alliance === "RED" ? "bg-red-500" : "bg-blue-500"
                    }`}
                  />
                  <div>
                    <Link
                      href={`/analytics/team/${entry.scoutedTeam?.teamNumber}`}
                      className="font-medium hover:text-ftc-orange"
                    >
                      Team {entry.scoutedTeam?.teamNumber}
                    </Link>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Match {entry.matchNumber} at {entry.eventCode}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{entry.totalScore}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
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
