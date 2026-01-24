"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { teamsApi } from "@/lib/api";

function JoinTeamForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setCode(codeParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    if (!code.trim()) {
      setError("Please enter an invite code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await teamsApi.joinTeam(session.user.id, code.trim());

      if (result.success && result.data) {
        router.push(`/my-teams/${result.data.teamId}`);
      } else {
        setError(result.error || "Failed to join team");
      }
    } catch (err) {
      setError("Failed to join team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="code" className="block text-sm font-medium mb-2">
            Invite Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter invite code"
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange focus:border-transparent text-center text-2xl tracking-widest font-mono uppercase"
            maxLength={8}
            required
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
            Ask your team admin for an invite code
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="w-full px-6 py-3 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? "Joining..." : "Join Team"}
      </button>
    </form>
  );
}

export default function JoinTeamPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <Link
          href="/my-teams"
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
        <h1 className="text-2xl font-bold">Join a Team</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Enter an invite code to join an existing team
        </p>
      </div>

      <Suspense
        fallback={
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="animate-pulse h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        }
      >
        <JoinTeamForm />
      </Suspense>

      <div className="mt-8 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Don&apos;t have a team?
        </p>
        <Link
          href="/my-teams/create"
          className="text-ftc-orange hover:underline font-medium"
        >
          Create a new team
        </Link>
      </div>
    </div>
  );
}
