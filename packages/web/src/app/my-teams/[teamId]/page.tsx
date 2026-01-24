"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { teamsApi } from "@/lib/api";

interface TeamMember {
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

interface TeamDetails {
  id: string;
  teamNumber: number;
  name: string;
  sharingLevel: string;
  members: TeamMember[];
  invites: TeamInvite[];
}

export default function TeamDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const currentUserRole = team?.members.find(
    (m) => m.userId === session?.user?.id
  )?.role;
  const isAdmin = currentUserRole === "ADMIN";
  const isMentor = currentUserRole === "MENTOR" || isAdmin;

  useEffect(() => {
    fetchTeam();
  }, [session?.user?.id, teamId]);

  async function fetchTeam() {
    if (!session?.user?.id) return;

    try {
      const result = await teamsApi.getTeam(session.user.id, teamId);
      if (result.success && result.data) {
        setTeam(result.data);
      } else {
        setError(result.error || "Failed to load team");
      }
    } catch (err) {
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
    const link = `${window.location.origin}/my-teams/join?code=${code}`;
    await navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

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
            href="/my-teams"
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
          href="/my-teams"
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
            <Link
              href={`/scout?team=${teamId}`}
              className="px-4 py-2 bg-ftc-orange text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Scout Matches
            </Link>
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
          <div className="space-y-3">
            {team.members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
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
                    <p className="font-medium">{member.user.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {member.user.email}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    member.role === "ADMIN"
                      ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                      : member.role === "MENTOR"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Invite Codes Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Invite Codes</h2>
            {isMentor && (
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-ftc-orange">{team.members.length}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Members</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-ftc-blue">0</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Matches Scouted</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-green-500">0</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Events</p>
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
  const [role, setRole] = useState<string>("MEMBER");
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
                <option value="MEMBER">Member</option>
                <option value="MENTOR">Mentor</option>
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
