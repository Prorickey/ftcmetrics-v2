"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usersApi } from "@/lib/api";
import { ApiKeysSection } from "@/components/api-keys-section";

export default function SettingsPage() {
  const { data: session, update } = useSession();

  // Profile form state — sync from session once loaded
  const [name, setName] = useState(session?.user?.name || "");
  const [image, setImage] = useState(session?.user?.image || "");
  const [imageCleared, setImageCleared] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (session?.user && !initialized) {
      setName(session.user.name || "");
      setImage(session.user.image || "");
      setInitialized(true);
    }
  }, [session?.user, initialized]);
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const currentImage = session?.user?.image || "";

  // Delete account state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setProfileMsg(null);

    try {
      const payload: { name: string; image?: string | null } = { name: name.trim() };
      if (imageCleared) {
        payload.image = null;
      } else if (image.trim() && image.trim() !== currentImage) {
        payload.image = image.trim();
      }
      const result = await usersApi.updateProfile(payload);

      if (result.success) {
        await update();
        setProfileMsg({ type: "success", text: "Profile updated" });
      } else {
        setProfileMsg({ type: "error", text: result.error || "Failed to update profile" });
      }
    } catch {
      setProfileMsg({ type: "error", text: "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);

    try {
      const result = await usersApi.deleteAccount();
      if (result.success) {
        signOut({ callbackUrl: "/" });
      } else {
        alert(result.error || "Failed to delete account");
        setDeleting(false);
      }
    } catch {
      alert("Failed to delete account");
      setDeleting(false);
    }
  }

  const initial = session?.user?.name?.charAt(0) || "U";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your profile, API keys, and account.
        </p>
      </div>

      {/* Profile Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-ftc-orange flex items-center justify-center text-white text-xl font-medium">
                {initial}
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{session?.user?.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{session?.user?.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full max-w-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Avatar URL{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="url"
                value={imageCleared ? "" : image}
                onChange={(e) => {
                  setImage(e.target.value);
                  setImageCleared(false);
                }}
                placeholder="https://example.com/avatar.jpg"
                maxLength={2000}
                disabled={imageCleared}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
              />
              {(currentImage || image.trim()) && !imageCleared && (
                <button
                  type="button"
                  onClick={() => {
                    setImageCleared(true);
                    setImage("");
                  }}
                  title="Remove avatar"
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              {imageCleared && (
                <button
                  type="button"
                  onClick={() => {
                    setImageCleared(false);
                    setImage(currentImage);
                  }}
                  title="Undo remove"
                  className="px-2 py-1 rounded-lg text-xs text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex-shrink-0 font-medium"
                >
                  Undo
                </button>
              )}
            </div>
            {imageCleared && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">Avatar will be removed on save</p>
            )}
          </div>

          {profileMsg && (
            <p className={`text-sm ${profileMsg.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {profileMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      {/* API Keys Section */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">API Keys</h2>
        <ApiKeysSection />
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-red-300 dark:border-red-800 p-6">
        <h2 className="text-base font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Once you delete your account, there is no going back. Your scouting data will be preserved
          but will no longer be associated with your account.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type <span className="font-mono font-bold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full max-w-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== "DELETE" || deleting}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {deleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
