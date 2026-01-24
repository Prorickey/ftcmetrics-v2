import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Welcome back, {session?.user?.name?.split(" ")[0] || "Scout"}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          DECODE 2025-2026 Season
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Link
          href="/scout"
          className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-ftc-orange dark:hover:border-ftc-orange transition-colors group"
        >
          <div className="w-12 h-12 bg-ftc-orange/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-ftc-orange/20 transition-colors">
            <svg
              className="w-6 h-6 text-ftc-orange"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-1">Scout a Match</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Record match data for teams at your event
          </p>
        </Link>

        <Link
          href="/analytics"
          className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-ftc-blue dark:hover:border-ftc-blue transition-colors group"
        >
          <div className="w-12 h-12 bg-ftc-blue/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-ftc-blue/20 transition-colors">
            <svg
              className="w-6 h-6 text-ftc-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-1">View Analytics</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            EPA, OPR rankings and match predictions
          </p>
        </Link>

        <Link
          href="/my-teams"
          className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-green-500 dark:hover:border-green-500 transition-colors group"
        >
          <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
            <svg
              className="w-6 h-6 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-1">My Teams</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Manage your FTC teams and members
          </p>
        </Link>
      </div>

      {/* Recent Activity Placeholder */}
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p>No recent activity</p>
          <p className="text-sm mt-1">Start scouting matches to see activity here</p>
        </div>
      </div>
    </div>
  );
}
