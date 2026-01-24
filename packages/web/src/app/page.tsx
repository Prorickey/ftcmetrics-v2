export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          FTC Metrics
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Scouting and analytics for DECODE 2025-2026
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </a>
          <a
            href="/analytics"
            className="px-6 py-3 border border-gray-300 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            View Analytics
          </a>
        </div>
      </div>
    </main>
  );
}
