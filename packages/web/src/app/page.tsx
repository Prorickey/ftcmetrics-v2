import { auth } from "@/lib/auth";
import { Header } from "@/components/header";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  // Redirect logged in users to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="py-20 text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            <span className="text-ftc-orange">FTC</span> Metrics
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            The complete scouting and analytics platform for FIRST Tech Challenge.
            Track match data, compute EPA/OPR rankings, and predict match outcomes.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 bg-ftc-orange text-white rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
            <Link
              href="/analytics"
              className="px-8 py-4 border border-gray-300 dark:border-gray-700 rounded-lg font-semibold text-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            >
              View Analytics
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="py-16 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-ftc-orange/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-ftc-orange"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Match Scouting</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Mobile-first scouting interface with offline support. Record DECODE scoring data in real-time.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-ftc-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-ftc-blue"
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
            <h3 className="text-xl font-semibold mb-2">Advanced Analytics</h3>
            <p className="text-gray-600 dark:text-gray-400">
              EPA and OPR calculations powered by official FTC Events API data. Track team performance over time.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-Time Updates</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Live match scores, instant EPA recalculations, and collaborative scouting with your team.
            </p>
          </div>
        </div>

        {/* Season Banner */}
        <div className="py-16">
          <div className="bg-gradient-to-r from-ftc-orange to-ftc-blue rounded-2xl p-8 text-white text-center">
            <h2 className="text-3xl font-bold mb-2">DECODE 2025-2026</h2>
            <p className="text-white/80 text-lg">
              Built for the current FTC season with game-specific scoring fields
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600 dark:text-gray-400">
          <p>FTC Metrics - Open Source Scouting Platform</p>
          <p className="text-sm mt-2">
            Not affiliated with FIRST or FIRST Tech Challenge
          </p>
        </div>
      </footer>
    </div>
  );
}
