"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { teamsApi } from "@/lib/api";

interface UserTeam {
  teamId: string;
  role: string;
  team: {
    id: string;
    teamNumber: number;
    name: string;
    sharingLevel: string;
  };
}

export default function MyTeamsPage() {
  const { data: session } = useSession();
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTeams() {
      if (!session?.user?.id) return;

      try {
        const result = await teamsApi.getMyTeams(session.user.id);
        if (result.success && result.data) {
          setTeams(result.data);
        } else {
          setError(result.error || "Failed to load teams");
        }
      } catch (err) {
        setError("Failed to load teams");
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Teams</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your FTC teams and scouting groups
          </p>
        </div>
        <div className="flex gap-3">
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

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {teams.length === 0 ? (
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create a new team or join an existing one to start scouting
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/my-teams/join"
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Join with Code
            </Link>
            <Link
              href="/my-teams/create"
              className="px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Create Team
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {teams.map(({ teamId, role, team }) => (
            <Link
              key={teamId}
              href={`/my-teams/${teamId}`}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 hover:border-ftc-orange dark:hover:border-ftc-orange transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-ftc-orange/10 rounded-lg flex items-center justify-center">
                    <span className="font-bold text-ftc-orange">
                      {team.teamNumber}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{team.name}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Team {team.teamNumber}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      role === "ADMIN"
                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        : role === "MENTOR"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {role.charAt(0) + role.slice(1).toLowerCase()}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs ${
                      team.sharingLevel === "PUBLIC"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : team.sharingLevel === "EVENT"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {team.sharingLevel.charAt(0) +
                      team.sharingLevel.slice(1).toLowerCase()}{" "}
                    sharing
                  </span>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
