"use client";

import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { teamsApi, eventsApi, scoutingApi } from "@/lib/api";

interface UserTeam {
  teamId: string;
  role: string;
  team: {
    id: string;
    teamNumber: number;
    name: string;
  };
}

interface FTCEvent {
  code: string;
  name: string;
  city: string;
  stateprov: string;
  country: string;
  dateStart: string;
  dateEnd: string;
  type: string;
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
  allianceNotes: string | null;
  autoScore: number;
  teleopScore: number;
  endgameScore: number;
  totalScore: number;
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

interface EditFormData {
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
}

// Counter Field Component (matches the pattern from scout/match/page.tsx)
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
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{points}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          -
        </button>
        <span className="w-6 text-center text-lg font-bold">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-9 h-9 bg-ftc-orange text-white rounded-lg flex items-center justify-center text-lg font-bold hover:opacity-90 transition-opacity"
        >
          +
        </button>
      </div>
    </div>
  );
}

function EditEntryForm({
  entry,
  userId,
  onSave,
  onCancel,
}: {
  entry: ScoutingEntry;
  userId: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState<EditFormData>({
    matchNumber: entry.matchNumber,
    alliance: entry.alliance,
    autoLeave: entry.autoLeave,
    autoClassifiedCount: entry.autoClassifiedCount,
    autoOverflowCount: entry.autoOverflowCount,
    autoPatternCount: entry.autoPatternCount,
    teleopClassifiedCount: entry.teleopClassifiedCount,
    teleopOverflowCount: entry.teleopOverflowCount,
    teleopDepotCount: entry.teleopDepotCount,
    teleopPatternCount: entry.teleopPatternCount,
    teleopMotifCount: entry.teleopMotifCount,
    endgameBaseStatus: entry.endgameBaseStatus,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const result = await scoutingApi.updateEntry(userId, entry.id, data);
      if (result.success) {
        onSave();
      } else {
        setError(result.error || "Failed to update entry");
      }
    } catch {
      setError("Failed to update entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Match Info */}
      <div>
        <p className="text-sm font-medium mb-2">Match Info</p>
        <div className="grid gap-3 grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Match #
            </label>
            <input
              type="number"
              min={1}
              value={data.matchNumber}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  matchNumber: parseInt(e.target.value, 10) || 1,
                }))
              }
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Alliance
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setData((prev) => ({ ...prev, alliance: "RED" }))}
                className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                  data.alliance === "RED"
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                }`}
              >
                Red
              </button>
              <button
                type="button"
                onClick={() =>
                  setData((prev) => ({ ...prev, alliance: "BLUE" }))
                }
                className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
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

      {/* Autonomous */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Autonomous</p>
          <span className="text-xs font-medium text-ftc-orange">
            {autoScore} pts
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="font-medium text-sm">Leave Starting Zone</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">3 pts</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setData((prev) => ({ ...prev, autoLeave: !prev.autoLeave }))
              }
              className={`w-12 h-7 rounded-full transition-colors ${
                data.autoLeave
                  ? "bg-ftc-orange"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${
                  data.autoLeave ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
          <CounterField
            label="Classified (High)"
            points="3 pts each"
            value={data.autoClassifiedCount}
            onChange={(v) =>
              setData((prev) => ({ ...prev, autoClassifiedCount: v }))
            }
          />
          <CounterField
            label="Overflow (Low)"
            points="1 pt each"
            value={data.autoOverflowCount}
            onChange={(v) =>
              setData((prev) => ({ ...prev, autoOverflowCount: v }))
            }
          />
          <CounterField
            label="Pattern Complete"
            points="2 pts each"
            value={data.autoPatternCount}
            onChange={(v) =>
              setData((prev) => ({ ...prev, autoPatternCount: v }))
            }
          />
        </div>
      </div>

      {/* Teleop */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Teleop</p>
          <span className="text-xs font-medium text-ftc-blue">
            {teleopScore} pts
          </span>
        </div>
        <div className="space-y-2">
          <CounterField
            label="Classified (High)"
            points="3 pts each"
            value={data.teleopClassifiedCount}
            onChange={(v) =>
              setData((prev) => ({ ...prev, teleopClassifiedCount: v }))
            }
          />
          <CounterField
            label="Overflow (Low)"
            points="1 pt each"
            value={data.teleopOverflowCount}
            onChange={(v) =>
              setData((prev) => ({ ...prev, teleopOverflowCount: v }))
            }
          />
          <CounterField
            label="Depot"
            points="1 pt each"
            value={data.teleopDepotCount}
            onChange={(v) =>
              setData((prev) => ({ ...prev, teleopDepotCount: v }))
            }
          />
          <CounterField
            label="Pattern Complete"
            points="2 pts each"
            value={data.teleopPatternCount}
            onChange={(v) =>
              setData((prev) => ({ ...prev, teleopPatternCount: v }))
            }
          />
          <CounterField
            label="Motif Complete"
            points="2 pts each"
            value={data.teleopMotifCount}
            onChange={(v) =>
              setData((prev) => ({ ...prev, teleopMotifCount: v }))
            }
          />
        </div>
      </div>

      {/* Endgame */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Endgame</p>
          <span className="text-xs font-medium text-green-500">
            {endgameScore} pts
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["NONE", "PARTIAL", "FULL"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() =>
                setData((prev) => ({ ...prev, endgameBaseStatus: status }))
              }
              className={`py-2 rounded-lg font-medium text-sm transition-colors ${
                data.endgameBaseStatus === status
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              }`}
            >
              <span className="block">{status}</span>
              <span className="text-xs opacity-75">
                {status === "FULL"
                  ? "10 pts"
                  : status === "PARTIAL"
                  ? "5 pts"
                  : "0 pts"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Total Score */}
      <div className="bg-gradient-to-r from-ftc-orange to-ftc-blue rounded-lg p-4 text-white">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Estimated Total</span>
          <span className="text-2xl font-bold">{totalScore}</span>
        </div>
        <div className="flex justify-between mt-1 text-xs opacity-80">
          <span>Auto: {autoScore}</span>
          <span>Teleop: {teleopScore}</span>
          <span>Endgame: {endgameScore}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function ScoutContent() {
  const { data: session } = useSession();
  console.log("[Scout] Session loaded:", session?.user?.id ? `User ${session.user.id}` : "No session");
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedTeamId = searchParams.get("team");
  const preselectedEvent = searchParams.get("event");
  const preselectedTeamNumber = searchParams.get("teamNumber");

  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [events, setEvents] = useState<FTCEvent[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedEventCode, setSelectedEventCode] = useState<string>(preselectedEvent || "");
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Scouting entries state
  const [entries, setEntries] = useState<ScoutingEntry[]>([]);
  const [notes, setNotes] = useState<ScoutingNote[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [deductingId, setDeductingId] = useState<string | null>(null);
  const [deductMessage, setDeductMessage] = useState<{ id: string; text: string; type: "success" | "error" } | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(true);
  const [recentEventCodes, setRecentEventCodes] = useState<string[]>([]);

  useEffect(() => {
    async function fetchTeams() {
      if (!session?.user?.id) {
        console.log("[Scout] Skipping teams fetch - no session");
        return;
      }
      console.log("[Scout] Fetching user teams for user:", session.user.id);

      try {
        const result = await teamsApi.getMyTeams(session.user.id);
        console.log("[Scout] Teams fetch result:", { success: result.success, count: result.data?.length || 0, error: result.error });
        if (result.success && result.data) {
          setTeams(result.data);
          // Auto-select if preselected or only one team
          if (preselectedTeamId) {
            setSelectedTeam(preselectedTeamId);
          } else if (result.data.length === 1) {
            setSelectedTeam(result.data[0].teamId);
          }
        }
      } catch (err) {
        console.error("Failed to fetch teams:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, [session?.user?.id, preselectedTeamId]);

  // Auto-redirect to match form when coming from analytics page
  useEffect(() => {
    if (selectedTeam && preselectedEvent && preselectedTeamNumber) {
      const url = `/scout/match?team=${selectedTeam}&event=${preselectedEvent}&scoutedTeam=${preselectedTeamNumber}`;
      router.replace(url);
    }
  }, [selectedTeam, preselectedEvent, preselectedTeamNumber, router]);

  useEffect(() => {
    async function fetchEvents() {
      setEventsLoading(true);
      try {
        const result = await eventsApi.getEvents();
        if (result.success && result.data) {
          // Sort by date (soonest first)
          const sorted = result.data.sort(
            (a, b) =>
              new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
          );
          setEvents(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setEventsLoading(false);
      }
    }

    fetchEvents();
  }, []);

  // Load recent events from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ftcmetrics-recent-events");
      if (stored) {
        setRecentEventCodes(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Fetch scouting entries and notes for the selected team
  const hasLoadedOnce = useRef(false);
  const fetchEntries = useCallback(async () => {
    if (!session?.user?.id || !selectedTeam) {
      console.log("[Scout] Skipping entries fetch - missing session or team");
      return;
    }
    console.log("[Scout] Fetching entries and notes for team:", selectedTeam);
    // Only show loading skeleton on initial load, not on refetches
    if (!hasLoadedOnce.current) {
      setEntriesLoading(true);
    }
    try {
      console.log("[Scout] Calling getEntries and getNotes APIs...");
      const [entriesResult, notesResult] = await Promise.all([
        scoutingApi.getEntries(session.user.id, {
          scoutingTeamId: selectedTeam,
        }),
        scoutingApi.getNotes(session.user!.id, { notingTeamId: selectedTeam }),
      ]);
      console.log("[Scout] Entries fetch result:", { success: entriesResult.success, count: (entriesResult.data as unknown[])?.length || 0 });
      if (entriesResult.success && entriesResult.data) {
        setEntries(entriesResult.data as ScoutingEntry[]);
      }
      console.log("[Scout] Notes fetch result:", { success: notesResult.success, count: (notesResult.data as unknown[])?.length || 0 });
      if (notesResult.success && notesResult.data) {
        setNotes(notesResult.data as ScoutingNote[]);
      }
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setEntriesLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [session?.user?.id, selectedTeam]);

  // Reset loading flag when team changes so new team gets skeleton
  useEffect(() => {
    hasLoadedOnce.current = false;
  }, [selectedTeam]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Retry alliance deductions when entries finish loading (picks up newly available match data)
  useEffect(() => {
    if (entriesLoading || !session?.user?.id || !selectedTeam || entries.length === 0) return;

    let cancelled = false;

    async function retryDeductions() {
      const eventCodes = [...new Set(entries.map((e) => e.eventCode))];

      for (const eventCode of eventCodes) {
        if (cancelled) return;
        try {
          const result = await scoutingApi.retryDeductions(session!.user!.id, {
            eventCode,
            scoutingTeamId: selectedTeam,
          });
          if (!cancelled && result.success && result.data && result.data.deducted > 0) {
            fetchEntries();
            return;
          }
        } catch {
          // Silent failure — deductions will be retried on next page load
        }
      }
    }

    retryDeductions();

    return () => { cancelled = true; };
    // Only run once after entries first load for this team — not on entries changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesLoading, session?.user?.id, selectedTeam]);

  // Handle manual deduct partner action
  const handleDeductPartner = async (entryId: string) => {
    if (!session?.user?.id) return;
    setDeductingId(entryId);
    setDeductMessage(null);
    try {
      console.log("[Scout] Deducting partner for entry:", entryId);
      const result = await scoutingApi.deductPartner(session.user.id, entryId);
      console.log("[Scout] Deduct partner result:", { success: result.success, error: result.error });
      if (result.success) {
        setDeductMessage({ id: entryId, text: "Partner entry created", type: "success" });
        // Refresh entries to show the new deducted entry
        fetchEntries();
      } else {
        setDeductMessage({
          id: entryId,
          text: result.error || "Deduction failed",
          type: "error",
        });
      }
    } catch {
      setDeductMessage({ id: entryId, text: "Deduction failed", type: "error" });
    } finally {
      setDeductingId(null);
    }
  };

  // Save recently clicked event to localStorage
  const handleSelectEvent = useCallback((code: string) => {
    setSelectedEventCode(code);
    if (code) {
      setRecentEventCodes((prev) => {
        const updated = [code, ...prev.filter((c) => c !== code)].slice(0, 5);
        try {
          localStorage.setItem("ftcmetrics-recent-events", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  }, []);

  // Filter events based on search and date filter
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const filtered = events.filter((event) => {
      // Date filter
      if (showUpcomingOnly && new Date(event.dateEnd) < now) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          event.name.toLowerCase().includes(query) ||
          event.city.toLowerCase().includes(query) ||
          event.stateprov.toLowerCase().includes(query) ||
          event.code.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // Sort recent events to the top when not searching
    if (!searchQuery && recentEventCodes.length > 0) {
      filtered.sort((a, b) => {
        const aIdx = recentEventCodes.indexOf(a.code);
        const bIdx = recentEventCodes.indexOf(b.code);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });
    }

    return filtered;
  }, [events, searchQuery, showUpcomingOnly, recentEventCodes]);

  // Merge entries and notes into a single feed sorted by date
  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...entries.map((e) => ({ type: "entry" as const, data: e })),
      ...notes.map((n) => ({ type: "note" as const, data: n })),
    ];
    items.sort(
      (a, b) =>
        new Date(b.data.createdAt).getTime() -
        new Date(a.data.createdAt).getTime()
    );
    return items;
  }, [entries, notes]);

  const selectedEvent = events.find((e) => e.code === selectedEventCode);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
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
        <h2 className="text-xl font-semibold mb-2">Join a Team First</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You need to be part of a team to submit scouting data
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/teams/join"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Join Team
          </Link>
          <Link
            href="/teams/create"
            className="px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Create Team
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Scout Matches</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          DECODE 2025-2026 Season
        </p>
      </div>

      {/* Team Selection */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <label className="block text-sm font-medium mb-2">Scouting As</label>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
        >
          <option value="">Select your team</option>
          {teams.map(({ teamId, team }) => (
            <option key={teamId} value={teamId}>
              {team.teamNumber} - {team.name}
            </option>
          ))}
        </select>
      </div>

      {/* Event Selection with Search */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <label className="block text-sm font-medium mb-3">Find Event</label>

        {eventsLoading ? (
          <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ) : (
          <>
            {/* Search and Filter Row */}
            <div className="flex gap-3 mb-4">
              {/* Search Box */}
              <div className="flex-1 relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
                />
              </div>

              {/* Toggle for upcoming only */}
              <button
                onClick={() => setShowUpcomingOnly(!showUpcomingOnly)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  showUpcomingOnly
                    ? "bg-ftc-orange text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                }`}
              >
                Upcoming Only
              </button>
            </div>

            {/* Events List */}
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {filteredEvents.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No events found
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredEvents.slice(0, 30).map((event) => (
                    <button
                      key={event.code}
                      onClick={() => handleSelectEvent(event.code)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        selectedEventCode === event.code
                          ? "bg-ftc-orange/10 border-l-4 border-ftc-orange"
                          : ""
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">
                            {event.name}
                            {recentEventCodes.includes(event.code) && (
                              <span className="ml-2 text-xs font-medium text-ftc-orange">Recent</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {event.city}, {event.stateprov}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono text-gray-400">{event.code}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(event.dateStart).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredEvents.length > 30 && (
                    <div className="p-2 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
                      Showing 30 of {filteredEvents.length}. Use search to narrow down.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Event Display */}
            {selectedEvent && (
              <div className="mt-3 p-3 bg-ftc-orange/10 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium text-ftc-orange">{selectedEvent.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedEvent.city}, {selectedEvent.stateprov} • {selectedEvent.code}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEventCode("")}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Start Scouting Button */}
      {selectedTeam && selectedEventCode ? (
        <Link
          href={`/scout/match?team=${selectedTeam}&event=${selectedEventCode}`}
          className="block w-full py-4 bg-ftc-orange text-white rounded-xl font-medium text-center hover:opacity-90 transition-opacity text-lg"
        >
          Start Scouting
        </Link>
      ) : (
        <button
          disabled
          className="block w-full py-4 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl font-medium text-center cursor-not-allowed text-lg"
        >
          Select team and event to start
        </button>
      )}

      {/* Recent Entries & Notes */}
      <div className="mt-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold text-lg mb-4">Recent Activity</h2>
        {entriesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : feedItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No entries yet</p>
            <p className="text-sm mt-1">Your scouting submissions and notes will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedItems.map((item) => {
              if (item.type === "entry") {
                const entry = item.data;
                const isExpanded = expandedItemId === entry.id && editingEntryId !== entry.id;

                return (
                  <div
                    key={entry.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    onClick={() => {
                      if (editingEntryId === entry.id) return;
                      setExpandedItemId(expandedItemId === entry.id ? null : entry.id);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">
                            Team {entry.scoutedTeam.teamNumber}
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              entry.alliance === "RED"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {entry.alliance}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Match {entry.matchNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-mono text-xs">
                            {entry.eventCode}
                          </span>
                          <span>
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-ftc-orange">
                            Auto: {entry.autoScore}
                          </span>
                          <span className="text-ftc-blue">
                            Teleop: {entry.teleopScore}
                          </span>
                          <span className="text-green-500">
                            End: {entry.endgameScore}
                          </span>
                          <span className="font-bold">
                            Total: {entry.totalScore}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        {editingEntryId !== entry.id && (
                          <>
                            {deductMessage?.id === entry.id && (
                              <span
                                className={`text-xs ${
                                  deductMessage.type === "success"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-500 dark:text-red-400"
                                }`}
                              >
                                {deductMessage.text}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEntryId(entry.id);
                                setExpandedItemId(null);
                              }}
                              className="px-3 py-1.5 text-sm font-medium text-ftc-orange bg-ftc-orange/10 rounded-lg hover:bg-ftc-orange/20 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeductPartner(entry.id);
                              }}
                              disabled={deductingId === entry.id}
                              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {deductingId === entry.id ? "Deducting..." : "Deduct Partner"}
                            </button>
                          </>
                        )}
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
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
                      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                        {/* Autonomous */}
                        <div>
                          <p className="text-xs font-semibold text-ftc-orange uppercase tracking-wide mb-2">Autonomous — {entry.autoScore} pts</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-600 dark:text-gray-400">Leave</span>
                              <span className="font-medium">{entry.autoLeave ? "Yes (3)" : "No (0)"}</span>
                            </div>
                            <div className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-600 dark:text-gray-400">Classified</span>
                              <span className="font-medium">{entry.autoClassifiedCount} ({entry.autoClassifiedCount * 3})</span>
                            </div>
                            <div className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-600 dark:text-gray-400">Overflow</span>
                              <span className="font-medium">{entry.autoOverflowCount} ({entry.autoOverflowCount})</span>
                            </div>
                            <div className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-600 dark:text-gray-400">Pattern</span>
                              <span className="font-medium">{entry.autoPatternCount} ({entry.autoPatternCount * 2})</span>
                            </div>
                          </div>
                        </div>

                        {/* Teleop */}
                        <div>
                          <p className="text-xs font-semibold text-ftc-blue uppercase tracking-wide mb-2">Teleop — {entry.teleopScore} pts</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-600 dark:text-gray-400">Classified</span>
                              <span className="font-medium">{entry.teleopClassifiedCount} ({entry.teleopClassifiedCount * 3})</span>
                            </div>
                            <div className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-600 dark:text-gray-400">Overflow</span>
                              <span className="font-medium">{entry.teleopOverflowCount} ({entry.teleopOverflowCount})</span>
                            </div>
                            <div className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-600 dark:text-gray-400">Depot</span>
                              <span className="font-medium">{entry.teleopDepotCount} ({entry.teleopDepotCount})</span>
                            </div>
                            <div className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-600 dark:text-gray-400">Pattern</span>
                              <span className="font-medium">{entry.teleopPatternCount} ({entry.teleopPatternCount * 2})</span>
                            </div>
                            <div className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-600 dark:text-gray-400">Motif</span>
                              <span className="font-medium">{entry.teleopMotifCount} ({entry.teleopMotifCount * 2})</span>
                            </div>
                          </div>
                        </div>

                        {/* Endgame */}
                        <div>
                          <p className="text-xs font-semibold text-green-500 uppercase tracking-wide mb-2">Endgame — {entry.endgameScore} pts</p>
                          <div className="text-sm bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5 inline-block">
                            <span className="text-gray-600 dark:text-gray-400">Base: </span>
                            <span className="font-medium">{entry.endgameBaseStatus}</span>
                          </div>
                        </div>

                        {/* Alliance Notes */}
                        {entry.allianceNotes && (
                          <div>
                            <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-2">Alliance Notes</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">
                              {entry.allianceNotes}
                            </p>
                          </div>
                        )}

                        {/* Scouter info */}
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          Scouted by {entry.scouter.name}
                        </div>

                        {/* Deduct Partner action — also shown here for easy access on small screens */}
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeductPartner(entry.id);
                            }}
                            disabled={deductingId === entry.id}
                            className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deductingId === entry.id ? "Deducting..." : "Deduct Partner"}
                          </button>
                          {deductMessage?.id === entry.id && (
                            <span
                              className={`text-xs ${
                                deductMessage.type === "success"
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-500 dark:text-red-400"
                              }`}
                            >
                              {deductMessage.text}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {editingEntryId === entry.id && session?.user?.id && (
                      <EditEntryForm
                        entry={entry}
                        userId={session.user.id}
                        onSave={() => {
                          setEditingEntryId(null);
                          fetchEntries();
                        }}
                        onCancel={() => setEditingEntryId(null)}
                      />
                    )}
                  </div>
                );
              }

              // Note card
              const note = item.data;
              const isExpanded = expandedItemId === note.id;

              return (
                <div
                  key={note.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => setExpandedItemId(expandedItemId === note.id ? null : note.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Purple notebook icon */}
                        <svg
                          className="w-4 h-4 text-purple-500 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-semibold">
                          Team {note.aboutTeam.teamNumber}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                          Note
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {note.eventCode && (
                          <span className="font-mono text-xs">{note.eventCode}</span>
                        )}
                        <span>
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {/* Preview text */}
                      {!isExpanded && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                          {note.generalNotes || note.strategyNotes || note.mechanicalNotes || "No notes"}
                        </p>
                      )}
                    </div>

                    <svg
                      className={`w-5 h-5 text-gray-400 ml-3 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Expanded note content */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                      {/* Ratings */}
                      {(note.reliabilityRating || note.driverSkillRating || note.defenseRating) && (
                        <div className="flex gap-4 text-sm">
                          {note.reliabilityRating && (
                            <div className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-500 dark:text-gray-400">Reliability: </span>
                              <span className="font-medium">{note.reliabilityRating}/5</span>
                            </div>
                          )}
                          {note.driverSkillRating && (
                            <div className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-500 dark:text-gray-400">Driver Skill: </span>
                              <span className="font-medium">{note.driverSkillRating}/5</span>
                            </div>
                          )}
                          {note.defenseRating && (
                            <div className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                              <span className="text-gray-500 dark:text-gray-400">Defense: </span>
                              <span className="font-medium">{note.defenseRating}/5</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes sections */}
                      {note.strategyNotes && (
                        <div>
                          <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">Strategy</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">
                            {note.strategyNotes}
                          </p>
                        </div>
                      )}
                      {note.mechanicalNotes && (
                        <div>
                          <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">Mechanical</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">
                            {note.mechanicalNotes}
                          </p>
                        </div>
                      )}
                      {note.generalNotes && (
                        <div>
                          <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">General</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">
                            {note.generalNotes}
                          </p>
                        </div>
                      )}

                      {/* Author info */}
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        By {note.author.name}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      }
    >
      <ScoutContent />
    </Suspense>
  );
}
