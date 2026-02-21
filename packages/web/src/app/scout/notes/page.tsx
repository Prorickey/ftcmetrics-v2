"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { teamsApi, eventsApi, scoutingApi, ftcTeamsApi } from "@/lib/api";

interface UserTeam {
  teamId: string;
  role: string;
  team: {
    id: string;
    teamNumber: number;
    name: string;
  };
}

interface ScoutingNote {
  id: string;
  aboutTeamId: string;
  aboutTeam: {
    id: string;
    teamNumber: number;
    name: string;
  };
  eventCode?: string;
  reliabilityRating?: number;
  driverSkillRating?: number;
  defenseRating?: number;
  strategyNotes?: string;
  mechanicalNotes?: string;
  generalNotes?: string;
  createdAt: string;
  author?: {
    name: string;
  };
}

function NotesContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const preselectedTeam = searchParams.get("team") || "";

  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [events, setEvents] = useState<Array<{ code: string; name: string }>>([]);
  const [selectedTeam, setSelectedTeam] = useState(preselectedTeam);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [notes, setNotes] = useState<ScoutingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    aboutTeamNumber: "",
    formEventCode: "",
    reliabilityRating: 3,
    driverSkillRating: 3,
    defenseRating: 3,
    strategyNotes: "",
    mechanicalNotes: "",
    generalNotes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [teamEvents, setTeamEvents] = useState<Array<{ eventCode: string; eventName: string }>>([]);
  const [formEventTeams, setFormEventTeams] = useState<Array<{ teamNumber: number; nameShort: string; nameFull: string }>>([]);
  const [formEventTeamsLoading, setFormEventTeamsLoading] = useState(false);

  // Fetch user's teams
  useEffect(() => {
    async function fetchTeams() {
      if (!session?.user?.id) return;

      try {
        const result = await teamsApi.getMyTeams(session.user.id);
        if (result.success && result.data) {
          setTeams(result.data);
          if (result.data.length === 1 && !preselectedTeam) {
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
  }, [session?.user?.id, preselectedTeam]);

  // Fetch events
  useEffect(() => {
    async function fetchEvents() {
      try {
        const result = await eventsApi.getEvents();
        if (result.success && result.data) {
          setEvents(result.data.map((e) => ({ code: e.code, name: e.name })));
        }
      } catch (err) {
        console.error("Failed to fetch events:", err);
      }
    }
    fetchEvents();
  }, []);

  // Fetch selected team's competitions
  useEffect(() => {
    async function fetchTeamEvents() {
      if (!selectedTeam) {
        setTeamEvents([]);
        return;
      }
      const team = teams.find((t) => t.teamId === selectedTeam);
      if (!team) return;
      try {
        const result = await ftcTeamsApi.getTeamEventSummaries(team.team.teamNumber);
        if (result.success && result.data) {
          setTeamEvents(
            result.data.map((e) => ({ eventCode: e.eventCode, eventName: e.eventName }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch team events:", err);
      }
    }
    fetchTeamEvents();
  }, [selectedTeam, teams]);

  // Fetch teams at the selected form event
  useEffect(() => {
    async function fetchFormEventTeams() {
      if (!formData.formEventCode) {
        setFormEventTeams([]);
        return;
      }
      setFormEventTeamsLoading(true);
      try {
        const result = await eventsApi.getEventTeams(formData.formEventCode);
        if (result.success && result.data) {
          setFormEventTeams(
            result.data.sort((a, b) => a.teamNumber - b.teamNumber)
          );
        }
      } catch (err) {
        console.error("Failed to fetch event teams:", err);
      } finally {
        setFormEventTeamsLoading(false);
      }
    }
    fetchFormEventTeams();
  }, [formData.formEventCode]);

  // Fetch notes when filters change
  useEffect(() => {
    if (!selectedTeam) return;

    async function fetchNotes() {
      if (!session?.user?.id) return;
      setNotesLoading(true);
      try {
        const result = await scoutingApi.getNotes(session.user.id, {
          notingTeamId: selectedTeam,
          eventCode: selectedEvent || undefined,
        });
        if (result.success && result.data) {
          setNotes(result.data as ScoutingNote[]);
        }
      } catch (err) {
        console.error("Failed to fetch notes:", err);
      } finally {
        setNotesLoading(false);
      }
    }

    fetchNotes();
  }, [selectedTeam, selectedEvent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !selectedTeam) return;

    const teamNumber = parseInt(formData.aboutTeamNumber, 10);
    if (isNaN(teamNumber) || teamNumber <= 0) {
      setError("Please enter a valid team number");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await scoutingApi.submitNote(session.user.id, {
        notingTeamId: selectedTeam,
        aboutTeamNumber: teamNumber,
        eventCode: formData.formEventCode || selectedEvent || undefined,
        reliabilityRating: formData.reliabilityRating,
        driverSkillRating: formData.driverSkillRating,
        defenseRating: formData.defenseRating,
        strategyNotes: formData.strategyNotes || undefined,
        mechanicalNotes: formData.mechanicalNotes || undefined,
        generalNotes: formData.generalNotes || undefined,
      });

      if (result.success) {
        setSuccess(true);
        setShowForm(false);
        setFormData((prev) => ({
          aboutTeamNumber: "",
          formEventCode: prev.formEventCode,
          reliabilityRating: 3,
          driverSkillRating: 3,
          defenseRating: 3,
          strategyNotes: "",
          mechanicalNotes: "",
          generalNotes: "",
        }));
        // Refresh notes
        const notesResult = await scoutingApi.getNotes(session.user!.id, {
          notingTeamId: selectedTeam,
          eventCode: selectedEvent || undefined,
        });
        if (notesResult.success && notesResult.data) {
          setNotes(notesResult.data as ScoutingNote[]);
        }
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to submit note");
      }
    } catch (err) {
      setError("Failed to submit note");
    } finally {
      setSubmitting(false);
    }
  };

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
        <h2 className="text-xl font-semibold mb-2">Join a Team First</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You need to be part of a team to view and submit scouting notes
        </p>
        <Link
          href="/my-teams"
          className="px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90"
        >
          My Teams
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/scout"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Scout
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Scouting Notes</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Qualitative observations about teams
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            {showForm ? "Cancel" : "Add Note"}
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400">
          Note submitted successfully!
        </div>
      )}

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <label className="block text-sm font-medium mb-2">Your Team</label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <option value="">Select team</option>
            {teams.map(({ teamId, team }) => (
              <option key={teamId} value={teamId}>
                {team.teamNumber} - {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <label className="block text-sm font-medium mb-2">Filter by Event</label>
          <EventDropdown
            events={events}
            selectedEvent={selectedEvent}
            onSelect={setSelectedEvent}
          />
        </div>
      </div>

      {/* Add Note Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <h2 className="font-semibold text-lg mb-4">Add New Note</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Competition</label>
                <select
                  value={formData.formEventCode}
                  onChange={(e) =>
                    setFormData({ ...formData, formEventCode: e.target.value, aboutTeamNumber: "" })
                  }
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <option value="">No competition</option>
                  {teamEvents.map((event) => (
                    <option key={event.eventCode} value={event.eventCode}>
                      {event.eventName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">About Team</label>
                {formEventTeamsLoading ? (
                  <div className="h-[42px] bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ) : formData.formEventCode && formEventTeams.length > 0 ? (
                  <select
                    value={formData.aboutTeamNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, aboutTeamNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                    required
                  >
                    <option value="">Select team</option>
                    {formEventTeams.map((team) => (
                      <option key={team.teamNumber} value={String(team.teamNumber)}>
                        {team.teamNumber} - {team.nameShort || team.nameFull}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    value={formData.aboutTeamNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, aboutTeamNumber: e.target.value })
                    }
                    placeholder="e.g., 12345"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                    required
                  />
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium mb-1">Reliability (1-5)</label>
                <RatingInput
                  value={formData.reliabilityRating}
                  onChange={(v) => setFormData({ ...formData, reliabilityRating: v })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Driver Skill (1-5)</label>
                <RatingInput
                  value={formData.driverSkillRating}
                  onChange={(v) => setFormData({ ...formData, driverSkillRating: v })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Defense (1-5)</label>
                <RatingInput
                  value={formData.defenseRating}
                  onChange={(v) => setFormData({ ...formData, defenseRating: v })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Strategy Notes</label>
              <textarea
                value={formData.strategyNotes}
                onChange={(e) => setFormData({ ...formData, strategyNotes: e.target.value })}
                placeholder="What strategies does this team use?"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Mechanical Notes</label>
              <textarea
                value={formData.mechanicalNotes}
                onChange={(e) => setFormData({ ...formData, mechanicalNotes: e.target.value })}
                placeholder="Robot capabilities, build quality, etc."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">General Notes</label>
              <textarea
                value={formData.generalNotes}
                onChange={(e) => setFormData({ ...formData, generalNotes: e.target.value })}
                placeholder="Any other observations..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Note"}
            </button>
          </form>
        </div>
      )}

      {/* Notes List */}
      {notesLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            {selectedTeam ? "No notes found" : "Select a team to view notes"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Link
                    href={`/analytics/team/${note.aboutTeam.teamNumber}`}
                    className="text-xl font-bold text-ftc-orange hover:underline"
                  >
                    Team {note.aboutTeam.teamNumber} - {note.aboutTeam.name}
                  </Link>
                  {note.eventCode && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Event: {note.eventCode}
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(note.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Ratings */}
              <div className="flex gap-6 mb-4">
                {note.reliabilityRating && (
                  <div className="text-center">
                    <p className="text-2xl font-bold">{note.reliabilityRating}</p>
                    <p className="text-xs text-gray-500">Reliability</p>
                  </div>
                )}
                {note.driverSkillRating && (
                  <div className="text-center">
                    <p className="text-2xl font-bold">{note.driverSkillRating}</p>
                    <p className="text-xs text-gray-500">Driver Skill</p>
                  </div>
                )}
                {note.defenseRating && (
                  <div className="text-center">
                    <p className="text-2xl font-bold">{note.defenseRating}</p>
                    <p className="text-xs text-gray-500">Defense</p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-3">
                {note.strategyNotes && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Strategy</p>
                    <p className="text-sm">{note.strategyNotes}</p>
                  </div>
                )}
                {note.mechanicalNotes && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Mechanical</p>
                    <p className="text-sm">{note.mechanicalNotes}</p>
                  </div>
                )}
                {note.generalNotes && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">General</p>
                    <p className="text-sm">{note.generalNotes}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventDropdown({
  events,
  selectedEvent,
  onSelect,
}: {
  events: Array<{ code: string; name: string }>;
  selectedEvent: string;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedName = events.find((e) => e.code === selectedEvent)?.name || "All Events";

  const filtered = events.filter((event) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      event.name.toLowerCase().includes(query) ||
      event.code.toLowerCase().includes(query)
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-left flex items-center justify-between"
      >
        <span className={selectedEvent ? "" : "text-gray-500 dark:text-gray-400"}>
          {selectedName}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-ftc-orange"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onSelect("");
                setOpen(false);
                setSearch("");
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                !selectedEvent ? "text-ftc-orange font-medium" : ""
              }`}
            >
              All Events
            </button>
            {filtered.map((event) => (
              <button
                key={event.code}
                type="button"
                onClick={() => {
                  onSelect(event.code);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  selectedEvent === event.code ? "text-ftc-orange font-medium" : ""
                }`}
              >
                <span className="block truncate">{event.name}</span>
                <span className="block text-xs font-mono text-gray-400">{event.code}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                No events found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          className={`w-10 h-10 rounded-lg font-medium transition-colors ${
            value >= rating
              ? "bg-ftc-orange text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
          }`}
        >
          {rating}
        </button>
      ))}
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
        </div>
      }
    >
      <NotesContent />
    </Suspense>
  );
}
