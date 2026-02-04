"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { scoutingApi, eventsApi } from "@/lib/api";
import {
  queueScoutingEntry,
  syncPendingEntries,
  getQueueCount,
  isOnline,
} from "@/lib/offline-queue";

interface EventTeam {
  teamNumber: number;
  nameFull: string;
  nameShort: string;
}

interface ScoutingData {
  scoutedTeamNumber: number;
  matchNumber: number | "";
  alliance: "RED" | "BLUE";
  // AUTO
  autoLeave: boolean;
  autoClassifiedCount: number;
  autoOverflowCount: number;
  autoPatternCount: number;
  // TELEOP
  teleopClassifiedCount: number;
  teleopOverflowCount: number;
  teleopDepotCount: number;
  teleopPatternCount: number;
  teleopMotifCount: number;
  // ENDGAME
  endgameBaseStatus: "NONE" | "PARTIAL" | "FULL";
  // NOTES
  allianceNotes: string;
}

const initialData: ScoutingData = {
  scoutedTeamNumber: 0,
  matchNumber: 1,
  alliance: "RED",
  autoLeave: false,
  autoClassifiedCount: 0,
  autoOverflowCount: 0,
  autoPatternCount: 0,
  teleopClassifiedCount: 0,
  teleopOverflowCount: 0,
  teleopDepotCount: 0,
  teleopPatternCount: 0,
  teleopMotifCount: 0,
  endgameBaseStatus: "NONE",
  allianceNotes: "",
};

function ScoutMatchContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamId = searchParams.get("team") || "";
  const eventCode = searchParams.get("event") || "";

  const preselectedScoutedTeam = searchParams.get("scoutedTeam");

  const [eventTeams, setEventTeams] = useState<EventTeam[]>([]);
  const [data, setData] = useState<ScoutingData>({
    ...initialData,
    scoutedTeamNumber: preselectedScoutedTeam ? parseInt(preselectedScoutedTeam, 10) : 0,
  });
  const [loading, setLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Calculate scores for display
  const autoScore =
    (data.autoLeave ? 3 : 0) +
    data.autoClassifiedCount * 3 +
    data.autoOverflowCount * 1 +
    data.autoPatternCount * 2;

  const teleopScore =
    data.teleopClassifiedCount * 3 +
    data.teleopOverflowCount * 1 +
    data.teleopDepotCount * 1 +
    data.teleopPatternCount * 2 +
    data.teleopMotifCount * 2;

  const endgameScore =
    data.endgameBaseStatus === "FULL"
      ? 10
      : data.endgameBaseStatus === "PARTIAL"
      ? 5
      : 0;

  const totalScore = autoScore + teleopScore + endgameScore;

  // Monitor online/offline status and queue count
  useEffect(() => {
    const updateOnlineStatus = () => {
      setOnline(isOnline());
    };

    const updateQueueCount = async () => {
      try {
        const count = await getQueueCount();
        setQueueCount(count);
      } catch (err) {
        console.error("Failed to get queue count:", err);
      }
    };

    // Initial check
    updateOnlineStatus();
    updateQueueCount();

    // Listen for online/offline events
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    // Update queue count periodically
    const interval = setInterval(updateQueueCount, 5000);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      clearInterval(interval);
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    async function autoSync() {
      if (online && queueCount > 0 && !syncing && session?.user?.id) {
        setSyncing(true);
        try {
          const result = await syncPendingEntries();
          if (result.synced > 0) {
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
          }
          // Update queue count after sync
          const newCount = await getQueueCount();
          setQueueCount(newCount);
        } catch (err) {
          console.error("Auto-sync failed:", err);
        } finally {
          setSyncing(false);
        }
      }
    }

    autoSync();
  }, [online, queueCount, syncing, session?.user?.id]);

  useEffect(() => {
    async function fetchEventTeams() {
      if (!eventCode) return;

      try {
        const result = await eventsApi.getEventTeams(eventCode);
        if (result.success && result.data) {
          setEventTeams(
            result.data.sort((a, b) => a.teamNumber - b.teamNumber)
          );
        }
      } catch (err) {
        console.error("Failed to fetch event teams:", err);
      } finally {
        setTeamsLoading(false);
      }
    }

    fetchEventTeams();
  }, [eventCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !teamId || !eventCode) return;

    if (!data.scoutedTeamNumber) {
      setError("Please select a team to scout");
      return;
    }

    if (!data.matchNumber) {
      setError("Please enter a match number");
      return;
    }

    setLoading(true);
    setError(null);

    const entryData = {
      scoutingTeamId: teamId,
      eventCode,
      ...data,
      matchNumber: data.matchNumber as number,
    };

    try {
      // Check if online
      if (!isOnline()) {
        // Queue for later submission
        await queueScoutingEntry(session.user.id, entryData);
        setSuccess(true);
        setError("Saved offline - will sync when connected");

        // Reset form for next match
        setData({
          ...initialData,
          matchNumber: data.matchNumber + 1,
        });

        // Update queue count
        const newCount = await getQueueCount();
        setQueueCount(newCount);

        setTimeout(() => {
          setSuccess(false);
          setError(null);
        }, 3000);
      } else {
        // Submit normally when online
        const result = await scoutingApi.submitEntry(session.user.id, entryData);

        if (result.success) {
          setSuccess(true);
          // Reset form for next match
          setData({
            ...initialData,
            matchNumber: data.matchNumber + 1,
          });
          setTimeout(() => setSuccess(false), 3000);
        } else {
          setError(result.error || "Failed to submit entry");
        }
      }
    } catch (err) {
      setError("Failed to submit entry");
    } finally {
      setLoading(false);
    }
  };

  const updateCount = (field: keyof ScoutingData, delta: number) => {
    setData((prev) => ({
      ...prev,
      [field]: Math.max(0, (prev[field] as number) + delta),
    }));
  };

  const handleManualSync = async () => {
    if (!online || queueCount === 0 || syncing) return;

    setSyncing(true);
    setError(null);

    try {
      const result = await syncPendingEntries();
      if (result.synced > 0) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
      if (result.failed > 0) {
        setError(`Synced ${result.synced} entries, ${result.failed} failed`);
      }
      // Update queue count after sync
      const newCount = await getQueueCount();
      setQueueCount(newCount);
    } catch (err) {
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (!teamId || !eventCode) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Missing team or event selection
        </p>
        <Link
          href="/scout"
          className="text-ftc-orange hover:underline font-medium"
        >
          Go back to scout setup
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/scout"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Scout Match</h1>
            <p className="text-gray-600 dark:text-gray-400">Event: {eventCode}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Queue count badge */}
            {queueCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  {queueCount} pending
                </span>
              </div>
            )}
            {/* Online/Offline indicator */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              online
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            }`}>
              <div className={`w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-red-500"}`} />
              <span className={`text-sm font-medium ${
                online ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}>
                {syncing ? "Syncing..." : online ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400">
          Entry submitted successfully!
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {queueCount > 0 && online && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {queueCount} {queueCount === 1 ? "entry" : "entries"} pending sync
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Entries will sync automatically when online
              </p>
            </div>
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Match Info */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="font-semibold text-lg mb-4">Match Info</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-2">Team</label>
              {teamsLoading ? (
                <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ) : (
                <select
                  value={data.scoutedTeamNumber}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      scoutedTeamNumber: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                  required
                >
                  <option value={0}>Select team</option>
                  {eventTeams.map((team) => (
                    <option key={team.teamNumber} value={team.teamNumber}>
                      {team.teamNumber} - {team.nameShort || team.nameFull}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Match #</label>
              <input
                type="number"
                min={1}
                value={data.matchNumber}
                onChange={(e) =>
                  setData((prev) => ({
                    ...prev,
                    matchNumber: e.target.value === "" ? "" : parseInt(e.target.value, 10),
                  }))
                }
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Alliance</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setData((prev) => ({ ...prev, alliance: "RED" }))}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    data.alliance === "RED"
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  Red
                </button>
                <button
                  type="button"
                  onClick={() => setData((prev) => ({ ...prev, alliance: "BLUE" }))}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    data.alliance === "BLUE"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  Blue
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Auto Scoring */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Autonomous</h2>
            <span className="text-sm font-medium text-ftc-orange">
              {autoScore} pts
            </span>
          </div>

          <div className="space-y-4">
            {/* Leave */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium">Leave Starting Zone</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">3 pts</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setData((prev) => ({ ...prev, autoLeave: !prev.autoLeave }))
                }
                className={`w-12 h-7 rounded-full transition-colors ${
                  data.autoLeave ? "bg-ftc-orange" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${
                    data.autoLeave ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {/* Classified */}
            <CounterField
              label="Classified (High)"
              points="3 pts each"
              value={data.autoClassifiedCount}
              onChange={(v) => setData((prev) => ({ ...prev, autoClassifiedCount: v }))}
            />

            {/* Overflow */}
            <CounterField
              label="Overflow (Low)"
              points="1 pt each"
              value={data.autoOverflowCount}
              onChange={(v) => setData((prev) => ({ ...prev, autoOverflowCount: v }))}
            />

            {/* Pattern */}
            <CounterField
              label="Pattern Complete"
              points="2 pts each"
              value={data.autoPatternCount}
              onChange={(v) => setData((prev) => ({ ...prev, autoPatternCount: v }))}
            />
          </div>
        </div>

        {/* Teleop Scoring */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Teleop</h2>
            <span className="text-sm font-medium text-ftc-blue">
              {teleopScore} pts
            </span>
          </div>

          <div className="space-y-4">
            <CounterField
              label="Classified (High)"
              points="3 pts each"
              value={data.teleopClassifiedCount}
              onChange={(v) => setData((prev) => ({ ...prev, teleopClassifiedCount: v }))}
            />

            <CounterField
              label="Overflow (Low)"
              points="1 pt each"
              value={data.teleopOverflowCount}
              onChange={(v) => setData((prev) => ({ ...prev, teleopOverflowCount: v }))}
            />

            <CounterField
              label="Depot"
              points="1 pt each"
              value={data.teleopDepotCount}
              onChange={(v) => setData((prev) => ({ ...prev, teleopDepotCount: v }))}
            />

            <CounterField
              label="Pattern Complete"
              points="2 pts each"
              value={data.teleopPatternCount}
              onChange={(v) => setData((prev) => ({ ...prev, teleopPatternCount: v }))}
            />

            <CounterField
              label="Motif Complete"
              points="2 pts each"
              value={data.teleopMotifCount}
              onChange={(v) => setData((prev) => ({ ...prev, teleopMotifCount: v }))}
            />
          </div>
        </div>

        {/* Endgame */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Endgame</h2>
            <span className="text-sm font-medium text-green-500">
              {endgameScore} pts
            </span>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Base Status</p>
            <div className="grid grid-cols-3 gap-2">
              {(["NONE", "PARTIAL", "FULL"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setData((prev) => ({ ...prev, endgameBaseStatus: status }))
                  }
                  className={`py-3 rounded-lg font-medium transition-colors ${
                    data.endgameBaseStatus === status
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  <span className="block">{status}</span>
                  <span className="text-xs opacity-75">
                    {status === "FULL" ? "10 pts" : status === "PARTIAL" ? "5 pts" : "0 pts"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Alliance Notes */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="font-semibold text-lg mb-4">Alliance Notes</h2>
          <textarea
            value={data.allianceNotes}
            onChange={(e) =>
              setData((prev) => ({ ...prev, allianceNotes: e.target.value }))
            }
            placeholder="General observations about the alliance..."
            rows={3}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none"
          />
        </div>

        {/* Total Score Display */}
        <div className="bg-gradient-to-r from-ftc-orange to-ftc-blue rounded-xl p-6 text-white">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Estimated Total Score</span>
            <span className="text-4xl font-bold">{totalScore}</span>
          </div>
          <div className="flex justify-between mt-2 text-sm opacity-80">
            <span>Auto: {autoScore}</span>
            <span>Teleop: {teleopScore}</span>
            <span>Endgame: {endgameScore}</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !data.scoutedTeamNumber}
          className="w-full py-4 bg-ftc-orange text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 text-lg"
        >
          {loading ? "Submitting..." : "Submit Entry"}
        </button>
      </form>
    </div>
  );
}

// Counter Field Component
function CounterField({
  label,
  points,
  value,
  onChange,
}: {
  label: string;
  points: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{points}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          -
        </button>
        <span className="w-8 text-center text-xl font-bold">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-10 h-10 bg-ftc-orange text-white rounded-lg flex items-center justify-center text-xl font-bold hover:opacity-90 transition-opacity"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function ScoutMatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      }
    >
      <ScoutMatchContent />
    </Suspense>
  );
}
