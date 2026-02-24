"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { teamsApi, scoutingApi } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
console.log("[TeamDetail] Resolved API_URL:", API_URL);

function resolveMediaUrl(url: string): string {
  if (url.startsWith("/api/uploads/")) {
    return `${API_URL}${url.replace("/api", "")}`;
  }
  return url;
}

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

interface TeamInvite {
  id: string;
  code: string;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
}

interface TeamMedia {
  id: string;
  type: "CAD" | "VIDEO" | "PHOTO" | "LINK";
  title: string;
  url: string;
  description: string | null;
  sortOrder: number;
  isUpload?: boolean;
  fileSize?: number | null;
  mimeType?: string | null;
}

interface TeamLink {
  title: string;
  url: string;
}

interface TeamDetails {
  id: string;
  teamNumber: number;
  name: string;
  sharingLevel: string;
  bio: string | null;
  robotName: string | null;
  robotDesc: string | null;
  drivetrainType: string | null;
  links: TeamLink[] | null;
  members: TeamMember[];
  invites: TeamInvite[];
  media: TeamMedia[];
}

export default function TeamDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [stats, setStats] = useState<{
    matchesScouted: number;
    eventsCount: number;
    teamsScoutedCount: number;
    notesCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState<"CAD" | "VIDEO" | "PHOTO" | null>(null);
  const [mediaTab, setMediaTab] = useState<"CAD" | "VIDEO" | "PHOTO">("CAD");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [deletingMedia, setDeletingMedia] = useState<string | null>(null);

  const currentUserId = session?.user?.id;
  const isMember = team?.members.some((m) => m.userId === currentUserId);
  const currentUserMembership = team?.members.find((m) => m.userId === currentUserId);
  const isAdmin = currentUserMembership?.role === "MENTOR" || currentUserMembership?.role === "LEADER";

  useEffect(() => {
    console.log("[TeamDetail] useEffect fired for teamId:", teamId, "userId:", session?.user?.id);
    fetchTeam();
  }, [session?.user?.id, teamId]);

  async function fetchTeam() {
    if (!session?.user?.id) return;

    console.log("[TeamDetail] fetchTeam called for teamId:", teamId);
    try {
      const [teamResult, statsResult] = await Promise.all([
        teamsApi.getTeam(session.user.id, teamId),
        scoutingApi.getTeamStats(session.user.id, teamId),
      ]);

      console.log("[TeamDetail] Promise.all results - team:", teamResult, "stats:", statsResult);
      if (teamResult.success && teamResult.data) {
        setTeam(teamResult.data);
      } else {
        setError(teamResult.error || "Failed to load team");
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (err) {
      console.error("[TeamDetail] Error fetching team:", err);
      setError("Failed to load team");
    } finally {
      setLoading(false);
    }
  }

  const copyInviteCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyInviteLink = async (code: string) => {
    const link = `${window.location.origin}/teams/join?code=${code}`;
    await navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!session?.user?.id) return;

    setRoleUpdating(true);
    setRoleError(null);

    try {
      const result = await teamsApi.updateMember(
        session.user.id,
        teamId,
        memberId,
        { role: newRole }
      );

      if (result.success) {
        await fetchTeam();
      } else {
        setRoleError(result.error || "Failed to update role");
        setTimeout(() => setRoleError(null), 4000);
      }
    } catch (err) {
      setRoleError("Failed to update role");
      setTimeout(() => setRoleError(null), 4000);
    } finally {
      setRoleUpdating(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!session?.user?.id) return;
    setDeletingMedia(mediaId);
    try {
      const result = await teamsApi.removeMedia(session.user.id, teamId, mediaId);
      if (result.success) {
        await fetchTeam();
      }
    } catch {
      // silently fail
    } finally {
      setDeletingMedia(null);
    }
  };

  const getYouTubeThumbnail = (url: string): string | null => {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
  };

  const drivetrainLabels: Record<string, string> = {
    mecanum: "Mecanum",
    tank: "Tank",
    swerve: "Swerve",
    other: "Other",
  };

  const filteredMedia = team?.media?.filter((m) => m.type === mediaTab) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-ftc-orange border-t-transparent" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400">{error || "Team not found"}</p>
          <Link
            href="/teams"
            className="mt-4 inline-block text-ftc-orange hover:underline"
          >
            Back to My Teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/teams"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to My Teams
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{team.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Team {team.teamNumber}
            </p>
          </div>
          <div className="flex gap-2">
            {currentUserMembership?.role !== "FRIEND" && (
              <Link
                href={`/scout?team=${teamId}`}
                className="px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Scout Matches
              </Link>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Members Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="font-semibold text-lg mb-4">
            Members ({team.members.length})
          </h2>
          {roleError && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {roleError}
            </div>
          )}
          <div className="space-y-3">
            {team.members.map((member) => {
              const isSelf = member.userId === session?.user?.id;
              const canEditRole = isSelf || isAdmin;

              return (
                <div
                  key={member.userId}
                  className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg ${
                    isSelf ? "ring-1 ring-ftc-orange/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {member.user.image ? (
                      <img
                        src={member.user.image}
                        alt={member.user.name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-ftc-orange/20 flex items-center justify-center text-ftc-orange font-medium">
                        {member.user.name?.charAt(0) || "U"}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        {member.user.name}
                        {isSelf && (
                          <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {member.user.email}
                      </p>
                    </div>
                  </div>
                  {canEditRole ? (
                    <select
                      value={member.role}
                      disabled={roleUpdating}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      className={`px-2 py-1 rounded text-xs font-medium border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        member.role === "MENTOR"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                          : member.role === "LEADER"
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                          : member.role === "STUDENT"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <option value="MENTOR">Mentor</option>
                      <option value="LEADER">Leader</option>
                      <option value="STUDENT">Student</option>
                      <option value="FRIEND">Friend</option>
                    </select>
                  ) : (
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        member.role === "MENTOR"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : member.role === "LEADER"
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : member.role === "STUDENT"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Invite Codes Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Invite Codes</h2>
            {isAdmin && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="text-sm text-ftc-orange hover:underline"
              >
                + New Code
              </button>
            )}
          </div>
          {team.invites.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">
              No active invite codes
            </p>
          ) : (
            <div className="space-y-3">
              {team.invites.map((invite) => (
                <div
                  key={invite.id}
                  className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <code className="font-mono text-lg font-bold tracking-wider">
                      {invite.code}
                    </code>
                    <div className="flex gap-1">
                      <button
                        onClick={() => copyInviteCode(invite.code)}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Copy code"
                      >
                        {copiedCode === invite.code ? (
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => copyInviteLink(invite.code)}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Copy link"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {invite.maxUses
                        ? `${invite.uses}/${invite.maxUses} uses`
                        : `${invite.uses} uses`}
                    </span>
                    {invite.expiresAt && (
                      <span>
                        Expires{" "}
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold text-lg mb-4">Team Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-ftc-orange">{team.members.length}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Members</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-ftc-blue">{stats?.matchesScouted ?? 0}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Matches Scouted</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-green-500">{stats?.eventsCount ?? 0}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Events</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-yellow-500">{stats?.teamsScoutedCount ?? 0}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Teams Scouted</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-purple-500">
              {team.sharingLevel === "PUBLIC"
                ? "Public"
                : team.sharingLevel === "EVENT"
                ? "Event"
                : "Private"}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Sharing</p>
          </div>
        </div>
      </div>

      {/* Team Profile */}
      <div className="mt-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Team Profile</h2>
          {isAdmin && (
            <button
              onClick={() => setShowProfileModal(true)}
              className="text-sm text-ftc-orange hover:underline"
            >
              Edit Profile
            </button>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Bio</h3>
            {team.bio ? (
              <div
                className="text-sm whitespace-pre-wrap break-words [&_a]:text-ftc-orange [&_a]:underline [&_strong]:font-semibold [&_em]:italic"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(team.bio) }}
              />
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No bio yet</p>
            )}
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Robot</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                <p className="font-medium text-sm">
                  {team.robotName || <span className="text-gray-400 dark:text-gray-500 italic font-normal">Not set</span>}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">Drivetrain</p>
                <p className="font-medium text-sm">
                  {team.drivetrainType ? (
                    <span className="inline-block px-2 py-0.5 bg-ftc-orange/10 text-ftc-orange rounded text-xs font-medium">
                      {drivetrainLabels[team.drivetrainType] || team.drivetrainType}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic font-normal">Not set</span>
                  )}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg sm:col-span-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
                <p className="text-sm">
                  {team.robotDesc || <span className="text-gray-400 dark:text-gray-500 italic font-normal">Not set</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Links */}
          {(team.links && team.links.length > 0) || isAdmin ? (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Links</h3>
              {team.links && team.links.length > 0 ? (
                <div className="space-y-2">
                  {team.links.map((link, i) => (
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
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">No links yet</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Media */}
      <div className="mt-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Media</h2>
          {isAdmin && (
            <button
              onClick={() => setShowMediaModal(mediaTab)}
              className="text-sm text-ftc-orange hover:underline"
            >
              + Add
            </button>
          )}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(["CAD", "VIDEO", "PHOTO"] as const).map((tab) => {
            const count = team.media?.filter((m) => m.type === tab).length ?? 0;
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
            No {mediaTab === "CAD" ? "CAD files" : mediaTab === "VIDEO" ? "videos" : "photos"} yet
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
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteMedia(item.id)}
                        disabled={deletingMedia === item.id}
                        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Invite Modal */}
      {showInviteModal && (
        <CreateInviteModal
          teamId={teamId}
          userId={session?.user?.id || ""}
          onClose={() => setShowInviteModal(false)}
          onCreated={fetchTeam}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <TeamSettingsModal
          team={team}
          userId={session?.user?.id || ""}
          onClose={() => setShowSettingsModal(false)}
          onUpdated={fetchTeam}
        />
      )}

      {/* Edit Profile Modal */}
      {showProfileModal && (
        <EditProfileModal
          team={team}
          userId={session?.user?.id || ""}
          onClose={() => setShowProfileModal(false)}
          onUpdated={fetchTeam}
        />
      )}

      {/* Add Media Modal */}
      {showMediaModal && (
        <AddMediaModal
          teamId={teamId}
          userId={session?.user?.id || ""}
          defaultType={showMediaModal}
          onClose={() => setShowMediaModal(null)}
          onAdded={fetchTeam}
        />
      )}
    </div>
  );
}

// Create Invite Modal Component
function CreateInviteModal({
  teamId,
  userId,
  onClose,
  onCreated,
}: {
  teamId: string;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [maxUses, setMaxUses] = useState<string>("");
  const [expiresInDays, setExpiresInDays] = useState<string>("7");
  const [role, setRole] = useState<string>("STUDENT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await teamsApi.createInvite(userId, teamId, {
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
        expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
        role,
      });

      if (result.success && result.data) {
        setCreatedCode(result.data.code);
        onCreated();
      } else {
        setError(result.error || "Failed to create invite");
      }
    } catch (err) {
      setError("Failed to create invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Create Invite Code</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {createdCode ? (
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Invite code created!
            </p>
            <code className="block text-3xl font-mono font-bold tracking-widest mb-4">
              {createdCode}
            </code>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Max Uses (optional)
              </label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Expires In (days)
              </label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="">Never</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Member Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <option value="MENTOR">Mentor</option>
                <option value="LEADER">Leader</option>
                <option value="STUDENT">Student</option>
                <option value="FRIEND">Friend</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple markdown renderer for bio text.
 * Supports: **bold**, *italic*, [links](url), and newlines.
 */
function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match: string, linkText: string, url: string) => {
      const safeUrl = url.replace(/"/g, '&quot;');
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    }
  );
  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic: *text*
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return html;
}

// Team Settings Modal Component
function TeamSettingsModal({
  team,
  userId,
  onClose,
  onUpdated,
}: {
  team: TeamDetails;
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(team.name);
  const [sharingLevel, setSharingLevel] = useState(team.sharingLevel);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await teamsApi.updateTeam(userId, team.id, {
        name,
        sharingLevel,
      });

      if (result.success) {
        onUpdated();
        onClose();
      } else {
        setError(result.error || "Failed to update team");
      }
    } catch (err) {
      setError("Failed to update team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Team Settings</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Team Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Data Sharing
            </label>
            <select
              value={sharingLevel}
              onChange={(e) => setSharingLevel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <option value="PRIVATE">Private - Only team members</option>
              <option value="EVENT">Event - Teams at same events</option>
              <option value="PUBLIC">Public - Everyone</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Controls who can see your scouting data
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Edit Profile Modal Component
function EditProfileModal({
  team,
  userId,
  onClose,
  onUpdated,
}: {
  team: TeamDetails;
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [bio, setBio] = useState(team.bio || "");
  const [robotName, setRobotName] = useState(team.robotName || "");
  const [robotDesc, setRobotDesc] = useState(team.robotDesc || "");
  const [drivetrainType, setDrivetrainType] = useState(team.drivetrainType || "");
  const [links, setLinks] = useState<TeamLink[]>(team.links || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BIO_MAX = 2000;

  const addLink = () => setLinks([...links, { title: "", url: "" }]);
  const removeLink = (index: number) => setLinks(links.filter((_, i) => i !== index));
  const updateLink = (index: number, field: "title" | "url", value: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], [field]: value };
    setLinks(updated);
  };

  const handleSave = async () => {
    if (bio.length > BIO_MAX) return;
    setLoading(true);
    setError(null);

    // Filter out links with empty title or URL
    const validLinks = links.filter((l) => l.title.trim() && l.url.trim());

    try {
      const result = await teamsApi.updateTeam(userId, team.id, {
        bio,
        robotName,
        robotDesc,
        drivetrainType,
        links: validLinks.length > 0 ? validLinks : null,
      });

      if (result.success) {
        onUpdated();
        onClose();
      } else {
        setError(result.error || "Failed to update profile");
      }
    } catch {
      setError("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Edit Team Profile</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Bio
              <span className="ml-1 text-xs text-gray-400 font-normal">
                (Markdown supported)
              </span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={BIO_MAX}
              rows={4}
              placeholder="Tell other teams about your team..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-vertical"
            />
            <p className={`mt-1 text-xs ${bio.length > BIO_MAX * 0.9 ? "text-red-500" : "text-gray-400"}`}>
              {bio.length}/{BIO_MAX}
            </p>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="text-sm font-medium mb-3">Robot Info</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Robot Name</label>
                <input
                  type="text"
                  value={robotName}
                  onChange={(e) => setRobotName(e.target.value)}
                  placeholder="e.g., Scorpion MK3"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Robot Description</label>
                <textarea
                  value={robotDesc}
                  onChange={(e) => setRobotDesc(e.target.value)}
                  rows={2}
                  placeholder="Describe your robot's capabilities..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-vertical"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Drivetrain Type</label>
                <select
                  value={drivetrainType}
                  onChange={(e) => setDrivetrainType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <option value="">Not specified</option>
                  <option value="mecanum">Mecanum</option>
                  <option value="tank">Tank</option>
                  <option value="swerve">Swerve</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Links</p>
              <button
                type="button"
                onClick={addLink}
                className="text-sm text-ftc-orange hover:underline"
              >
                + Add Link
              </button>
            </div>
            {links.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No links added</p>
            ) : (
              <div className="space-y-3">
                {links.map((link, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={link.title}
                        onChange={(e) => updateLink(i, "title", e.target.value)}
                        placeholder="Title (e.g., GitHub)"
                        className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateLink(i, "url", e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLink(i)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors mt-1"
                      title="Remove link"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || bio.length > BIO_MAX}
              className="flex-1 px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Media Modal Component
function AddMediaModal({
  teamId,
  userId,
  defaultType,
  onClose,
  onAdded,
}: {
  teamId: string;
  userId: string;
  defaultType: "CAD" | "VIDEO" | "PHOTO";
  onClose: () => void;
  onAdded: () => void;
}) {
  const [type, setType] = useState<"CAD" | "VIDEO" | "PHOTO">(defaultType);
  const [mode, setMode] = useState<"upload" | "url">(type === "CAD" ? "url" : "upload");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpload = type === "PHOTO" || type === "VIDEO";
  const fileAccept = type === "PHOTO"
    ? "image/jpeg,image/png,image/webp,image/gif"
    : "video/mp4,video/webm,video/quicktime";
  const maxSizeMB = type === "PHOTO" ? 10 : 50;

  // Reset mode when type changes
  const handleTypeChange = (newType: "CAD" | "VIDEO" | "PHOTO") => {
    setType(newType);
    if (newType === "CAD") {
      setMode("url");
      setFile(null);
    } else {
      setMode("upload");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    // Auto-fill title from filename if empty
    if (selected && !title.trim()) {
      setTitle(selected.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (mode === "upload" && file) {
        // File upload
        const result = await teamsApi.uploadMedia(userId, teamId, {
          type: type as "PHOTO" | "VIDEO",
          title: title.trim(),
          description: description.trim() || undefined,
          file,
        });

        if (result.success) {
          onAdded();
          onClose();
        } else {
          setError(result.error || "Failed to upload media");
        }
      } else if (mode === "url" && url.trim()) {
        // URL-based
        const result = await teamsApi.addMedia(userId, teamId, {
          type,
          title: title.trim(),
          url: url.trim(),
          description: description.trim() || undefined,
        });

        if (result.success) {
          onAdded();
          onClose();
        } else {
          setError(result.error || "Failed to add media");
        }
      }
    } catch {
      setError("Failed to add media");
    } finally {
      setLoading(false);
    }
  };

  const isValid = title.trim() && (mode === "upload" ? !!file : !!url.trim());

  const urlPlaceholder =
    type === "CAD"
      ? "https://cad.onshape.com/..."
      : type === "VIDEO"
      ? "https://youtube.com/watch?v=..."
      : "https://imgur.com/...";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">
          Add {type === "CAD" ? "CAD File" : type === "VIDEO" ? "Video" : "Photo"}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as "CAD" | "VIDEO" | "PHOTO")}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <option value="CAD">CAD</option>
              <option value="VIDEO">Video</option>
              <option value="PHOTO">Photo</option>
            </select>
          </div>

          {/* Upload/URL toggle for PHOTO and VIDEO */}
          {canUpload && (
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === "upload"
                    ? "bg-white dark:bg-gray-700 shadow-sm"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setMode("url")}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === "url"
                    ? "bg-white dark:bg-gray-700 shadow-sm"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                Paste URL
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Robot CAD - Full Assembly"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            />
          </div>

          {mode === "upload" ? (
            <div>
              <label className="block text-sm font-medium mb-1">File</label>
              <input
                type="file"
                accept={fileAccept}
                onChange={handleFileChange}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-ftc-orange/10 file:text-ftc-orange hover:file:bg-ftc-orange/20"
              />
              {file && (
                <p className="mt-1 text-xs text-gray-500">
                  {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Max {maxSizeMB}MB
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={urlPlaceholder}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-vertical"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !isValid}
              className="flex-1 px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? (mode === "upload" ? "Uploading..." : "Adding...") : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
