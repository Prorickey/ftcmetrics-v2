"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { teamsApi, ftcTeamsApi } from "@/lib/api";

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

interface SearchResult {
  teamNumber: number;
  nameShort: string;
  nameFull: string;
  city: string | null;
  stateProv: string | null;
}

interface FtcTeamInfo {
  teamNumber: number;
  nameFull: string;
  nameShort: string;
  city: string;
  stateProv: string;
  country: string;
  rookieYear: number;
}

interface EventSummary {
  eventCode: string;
  eventName: string;
  city: string | null;
  stateProv: string | null;
  dateStart: string;
  rank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  qualAverage: number | null;
}

interface TeamProfile {
  bio: string | null;
  robotName: string | null;
  robotDesc: string | null;
  drivetrainType: string | null;
  links: Array<{ title: string; url: string }> | null;
  media: Array<{
    id: string;
    type: "CAD" | "VIDEO" | "PHOTO" | "LINK";
    title: string;
    url: string;
    description: string | null;
    sortOrder: number;
    isUpload?: boolean;
    fileSize?: number | null;
    mimeType?: string | null;
  }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function resolveMediaUrl(url: string): string {
  if (url.startsWith("/api/uploads/")) {
    return `${API_URL}${url.replace("/api", "")}`;
  }
  return url;
}

const drivetrainLabels: Record<string, string> = {
  mecanum: "Mecanum",
  tank: "Tank",
  swerve: "Swerve",
  other: "Other",
};

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match: string, linkText: string, url: string) => {
      const safeUrl = url.replace(/"/g, '&quot;');
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    }
  );
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return html;
}

export default function MyTeamsPage() {
  const { data: session } = useSession();
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myTeamNumbers = new Set(teams.map((t) => t.team.teamNumber));

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

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setSelectedTeamNumber(null);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!query.trim()) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await ftcTeamsApi.search(query.trim());
          if (result.success && result.data) {
            setSearchResults(result.data);
          }
        } catch {
          // silently fail
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    []
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* My Teams Header */}
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

      {/* My Teams List */}
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
                      role === "MENTOR"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : role === "LEADER"
                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        : role === "STUDENT"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
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

      {/* Team Search Section */}
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-1">Team Search</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Look up any FTC team to see their stats and profile
        </p>

        {/* Search Input */}
        <div className="relative">
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
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by team number or name..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-ftc-orange/50 focus:border-ftc-orange transition-colors"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-ftc-orange border-t-transparent" />
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && !selectedTeamNumber && (
          <div className="mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {searchResults.map((result) => {
              const isMyTeam = myTeamNumbers.has(result.teamNumber);
              return (
                <button
                  key={result.teamNumber}
                  onClick={() => setSelectedTeamNumber(result.teamNumber)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-ftc-orange whitespace-nowrap">
                      #{result.teamNumber}
                    </span>
                    <span className="font-medium truncate">
                      {result.nameShort}
                    </span>
                    {result.city && (
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
                        {result.city}
                        {result.stateProv ? `, ${result.stateProv}` : ""}
                      </span>
                    )}
                  </div>
                  {isMyTeam && (
                    <span className="ml-2 flex-shrink-0 px-2 py-0.5 bg-ftc-orange/10 text-ftc-orange text-xs font-medium rounded-full">
                      My Team
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* No Results */}
        {searchQuery.trim() && !searching && searchResults.length === 0 && (
          <p className="mt-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            No teams found for &ldquo;{searchQuery}&rdquo;
          </p>
        )}

        {/* Selected Team Profile */}
        {selectedTeamNumber && (
          <TeamProfileDisplay
            teamNumber={selectedTeamNumber}
            userId={session?.user?.id}
            isMyTeam={myTeamNumbers.has(selectedTeamNumber)}
            onClose={() => setSelectedTeamNumber(null)}
          />
        )}
      </div>
    </div>
  );
}

function TeamProfileDisplay({
  teamNumber,
  userId,
  isMyTeam,
  onClose,
}: {
  teamNumber: number;
  userId?: string;
  isMyTeam: boolean;
  onClose: () => void;
}) {
  const [teamInfo, setTeamInfo] = useState<FtcTeamInfo | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [profile, setProfile] = useState<TeamProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [mediaTab, setMediaTab] = useState<"CAD" | "VIDEO" | "PHOTO">("CAD");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTeamInfo(null);
    setEvents([]);
    setProfile(undefined);

    async function fetchAll() {
      const [infoRes, eventsRes, profileRes] = await Promise.all([
        ftcTeamsApi.getTeam(teamNumber).catch(() => null),
        ftcTeamsApi.getTeamEventSummaries(teamNumber).catch(() => null),
        ftcTeamsApi.getTeamProfile(teamNumber, userId).catch(() => null),
      ]);

      if (cancelled) return;

      if (infoRes?.success && infoRes.data) {
        setTeamInfo(infoRes.data);
      }
      if (eventsRes?.success && eventsRes.data) {
        setEvents(eventsRes.data as EventSummary[]);
      }
      setProfile(profileRes?.success ? (profileRes.data ?? null) : null);
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [teamNumber, userId]);

  const getYouTubeThumbnail = (url: string): string | null => {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
  };

  const hasProfile = profile && (profile.bio || profile.robotName || profile.robotDesc || profile.drivetrainType || (profile.links && profile.links.length > 0));
  const hasMedia = profile && profile.media && profile.media.length > 0;
  const filteredMedia = profile?.media?.filter((m) => m.type === mediaTab) ?? [];
  const recentEvents = events.slice(0, 5);

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Close / Back button */}
      <button
        onClick={onClose}
        className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to search results
      </button>

      {/* Team Info Card */}
      {teamInfo && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-ftc-orange/10 rounded-lg flex items-center justify-center">
              <span className="font-bold text-ftc-orange text-lg">
                {teamInfo.teamNumber}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold">{teamInfo.nameShort}</h3>
              {teamInfo.nameShort !== teamInfo.nameFull && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {teamInfo.nameFull}
                </p>
              )}
            </div>
            {isMyTeam && (
              <span className="ml-auto px-3 py-1 bg-ftc-orange/10 text-ftc-orange text-sm font-medium rounded-full">
                My Team
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
              <p className="font-medium text-sm">
                {[teamInfo.city, teamInfo.stateProv, teamInfo.country]
                  .filter(Boolean)
                  .join(", ") || "Unknown"}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Rookie Year</p>
              <p className="font-medium text-sm">{teamInfo.rookieYear || "Unknown"}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Events</p>
              <p className="font-medium text-sm">{events.length}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Team Number</p>
              <p className="font-medium text-sm">#{teamInfo.teamNumber}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Events Card */}
      {recentEvents.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-lg mb-4">Recent Events</h3>
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <Link
                key={event.eventCode}
                href={`/analytics/team/${teamNumber}/event/${event.eventCode}`}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate text-ftc-orange">
                    {event.eventName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(event.dateStart).toLocaleDateString()}
                    {event.city ? ` \u00B7 ${event.city}${event.stateProv ? `, ${event.stateProv}` : ""}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {event.rank !== null && (
                    <span className="px-2 py-0.5 bg-ftc-orange/10 text-ftc-orange text-xs font-bold rounded">
                      Rank {event.rank}
                    </span>
                  )}
                  {event.wins !== null && (
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                      {event.wins}-{event.losses}-{event.ties}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          {events.length > 5 && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
              Showing 5 of {events.length} events
            </p>
          )}
        </div>
      )}

      {/* Profile: About Card */}
      {hasProfile && profile.bio && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-lg mb-3">About</h3>
          <div
            className="text-sm whitespace-pre-wrap break-words [&_a]:text-ftc-orange [&_a]:underline [&_strong]:font-semibold [&_em]:italic"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(profile.bio) }}
          />
        </div>
      )}

      {/* Profile: Robot Card */}
      {hasProfile && (profile.robotName || profile.drivetrainType || profile.robotDesc) && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-lg mb-3">Robot</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
              <p className="font-medium text-sm">
                {profile.robotName || (
                  <span className="text-gray-400 dark:text-gray-500 italic font-normal">Not set</span>
                )}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Drivetrain</p>
              <p className="font-medium text-sm">
                {profile.drivetrainType ? (
                  <span className="inline-block px-2 py-0.5 bg-ftc-orange/10 text-ftc-orange rounded text-xs font-medium">
                    {drivetrainLabels[profile.drivetrainType] || profile.drivetrainType}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 italic font-normal">Not set</span>
                )}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg sm:col-span-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
              <p className="text-sm">
                {profile.robotDesc || (
                  <span className="text-gray-400 dark:text-gray-500 italic font-normal">Not set</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile: Links Card */}
      {profile && profile.links && profile.links.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-lg mb-3">Links</h3>
          <div className="space-y-2">
            {profile.links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 text-ftc-orange flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="text-sm font-medium text-ftc-orange truncate">{link.title}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-auto">{link.url}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Profile: Media Card */}
      {hasMedia && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-lg mb-3">Media</h3>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(["CAD", "VIDEO", "PHOTO"] as const).map((tab) => {
              const count = profile.media?.filter((m) => m.type === tab).length ?? 0;
              return (
                <button
                  key={tab}
                  onClick={() => setMediaTab(tab)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mediaTab === tab
                      ? "bg-white dark:bg-gray-700 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {tab === "CAD" ? "CAD" : tab === "VIDEO" ? "Videos" : "Photos"}
                  {count > 0 && (
                    <span className="ml-1.5 text-xs text-gray-400">({count})</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Media Items */}
          {filteredMedia.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6 italic">
              No {mediaTab === "CAD" ? "CAD files" : mediaTab === "VIDEO" ? "videos" : "photos"}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredMedia.map((item) => {
                const isUploadedPhoto = item.isUpload && item.type === "PHOTO";
                const isUploadedVideo = item.isUpload && item.type === "VIDEO";
                const ytThumb = !item.isUpload && item.type === "VIDEO" ? getYouTubeThumbnail(item.url) : null;
                const mediaUrl = resolveMediaUrl(item.url);
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    {isUploadedPhoto && (
                      <img
                        src={mediaUrl}
                        alt={item.title}
                        className="w-full max-h-64 object-contain rounded mb-2"
                      />
                    )}
                    {isUploadedVideo && (
                      <video
                        src={mediaUrl}
                        controls
                        className="w-full max-h-64 rounded mb-2"
                      />
                    )}
                    <div className="flex items-start gap-3">
                      {ytThumb && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <img
                            src={ytThumb}
                            alt={item.title}
                            className="w-28 h-16 object-cover rounded"
                          />
                        </a>
                      )}
                      <div className="flex-1 min-w-0">
                        {item.isUpload ? (
                          <p className="font-medium text-sm truncate">{item.title}</p>
                        ) : (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm text-ftc-orange hover:underline truncate block"
                          >
                            {item.title}
                          </a>
                        )}
                        {item.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        {item.isUpload && item.fileSize && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {(item.fileSize / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* No Profile Message */}
      {profile === null && !hasProfile && !hasMedia && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            This team hasn&apos;t set up a profile yet
          </p>
        </div>
      )}
    </div>
  );
}
