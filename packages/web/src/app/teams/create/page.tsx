"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { teamsApi, ftcTeamsApi } from "@/lib/api";

export default function CreateTeamPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [teamNumber, setTeamNumber] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ftcTeamInfo, setFtcTeamInfo] = useState<{
    nameFull: string;
    city: string;
    stateProv: string;
  } | null>(null);

  const lookupTeam = async () => {
    const num = parseInt(teamNumber, 10);
    if (isNaN(num) || num <= 0) {
      setError("Please enter a valid team number");
      return;
    }

    setLookingUp(true);
    setError(null);
    setFtcTeamInfo(null);

    try {
      const result = await ftcTeamsApi.getTeam(num);
      if (result.success && result.data) {
        setFtcTeamInfo({
          nameFull: result.data.nameFull,
          city: result.data.city,
          stateProv: result.data.stateProv,
        });
        if (!teamName) {
          setTeamName(result.data.nameShort || result.data.nameFull);
        }
      } else {
        setError("Team not found in FTC database. You can still create it.");
      }
    } catch (err) {
      setError("Could not look up team. You can still create it.");
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    const num = parseInt(teamNumber, 10);
    if (isNaN(num) || num <= 0) {
      setError("Please enter a valid team number");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await teamsApi.createTeam(session.user.id, {
        teamNumber: num,
        name: teamName || `Team ${num}`,
      });

      if (result.success && result.data) {
        router.push(`/teams/${result.data.id}`);
      } else {
        setError(result.error || "Failed to create team");
      }
    } catch (err) {
      setError("Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <Link
          href="/teams"
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
          Back to My Teams
        </Link>
        <h1 className="text-2xl font-bold">Create Team</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Claim your FTC team to start scouting
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="teamNumber"
                className="block text-sm font-medium mb-2"
              >
                FTC Team Number
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  id="teamNumber"
                  value={teamNumber}
                  onChange={(e) => {
                    setTeamNumber(e.target.value);
                    setFtcTeamInfo(null);
                  }}
                  placeholder="e.g., 12345"
                  className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={lookupTeam}
                  disabled={lookingUp || !teamNumber}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {lookingUp ? "Looking up..." : "Look up"}
                </button>
              </div>
            </div>

            {ftcTeamInfo && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="font-medium text-green-800 dark:text-green-200">
                  {ftcTeamInfo.nameFull}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {ftcTeamInfo.city}, {ftcTeamInfo.stateProv}
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="teamName"
                className="block text-sm font-medium mb-2"
              >
                Display Name
              </label>
              <input
                type="text"
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Your team's display name"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Leave blank to use the official FTC team name
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="font-medium mb-3">What happens next?</h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              You become the team admin
            </li>
            <li className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Create invite codes for teammates to join
            </li>
            <li className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Start scouting matches together
            </li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading || !teamNumber}
          className="w-full px-6 py-3 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Team"}
        </button>
      </form>
    </div>
  );
}
