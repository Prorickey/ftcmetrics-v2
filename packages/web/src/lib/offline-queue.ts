/**
 * Offline queue for scouting entries using IndexedDB
 * Allows scouts to submit entries when offline and sync when connection is restored
 */

const DB_NAME = "ftc-metrics-offline";
const DB_VERSION = 1;
const STORE_NAME = "scouting-queue";

interface QueuedEntry {
  id: string;
  userId: string;
  data: {
    scoutingTeamId: string;
    scoutedTeamNumber: number;
    eventCode: string;
    matchNumber: number;
    alliance: "RED" | "BLUE";
    autoLeave?: boolean;
    autoClassifiedCount?: number;
    autoOverflowCount?: number;
    autoPatternCount?: number;
    teleopClassifiedCount?: number;
    teleopOverflowCount?: number;
    teleopDepotCount?: number;
    teleopPatternCount?: number;
    teleopMotifCount?: number;
    endgameBaseStatus?: "NONE" | "PARTIAL" | "FULL";
  };
  timestamp: number;
  _signature?: string;
}

/**
 * Per-session HMAC key for signing queued entries.
 * Resets on page reload — entries from previous sessions will fail verification
 * and must be re-submitted.
 */
let sessionKey: CryptoKey | null = null;

async function getSessionKey(): Promise<CryptoKey> {
  if (!sessionKey) {
    sessionKey = await crypto.subtle.generateKey(
      { name: "HMAC", hash: "SHA-256" },
      true,
      ["sign", "verify"]
    );
  }
  return sessionKey;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

/**
 * Compute HMAC-SHA256 signature for an entry (excluding the _signature field).
 */
async function signEntry(entry: QueuedEntry): Promise<string> {
  const key = await getSessionKey();
  const { _signature, ...entryData } = entry;
  const encoded = new TextEncoder().encode(JSON.stringify(entryData));
  const sig = await crypto.subtle.sign("HMAC", key, encoded);
  return arrayBufferToHex(sig);
}

/**
 * Verify the HMAC-SHA256 signature of an entry.
 */
async function verifyEntry(entry: QueuedEntry): Promise<boolean> {
  if (!entry._signature) return false;
  const key = await getSessionKey();
  const { _signature, ...entryData } = entry;
  const encoded = new TextEncoder().encode(JSON.stringify(entryData));
  const sigBuffer = hexToArrayBuffer(_signature);
  return crypto.subtle.verify("HMAC", key, sigBuffer, encoded);
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Queue a scouting entry for later submission
 */
export async function queueScoutingEntry(
  userId: string,
  data: QueuedEntry["data"]
): Promise<void> {
  const db = await openDB();

  const entry: QueuedEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    data,
    timestamp: Date.now(),
  };

  entry._signature = await signEntry(entry);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(entry);

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get all pending entries in the queue
 */
export async function getPendingEntries(): Promise<QueuedEntry[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      resolve(request.result || []);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Remove a specific entry from the queue
 */
async function removeEntry(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get the count of pending entries
 */
export async function getQueueCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Sync all pending entries to the server
 * Returns the number of successfully synced entries
 */
export async function syncPendingEntries(
  apiUrl: string = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
): Promise<{ synced: number; failed: number; errors: string[] }> {
  if (!isOnline()) {
    return { synced: 0, failed: 0, errors: ["Device is offline"] };
  }

  const entries = await getPendingEntries();
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    // Verify HMAC signature before syncing
    const valid = await verifyEntry(entry);
    if (!valid) {
      console.warn(
        `[offline-queue] Skipping entry ${entry.id}: HMAC signature verification failed (possible tampering or session mismatch)`
      );
      failed++;
      errors.push(`Match ${entry.data.matchNumber}: signature verification failed`);
      continue;
    }

    try {
      const response = await fetch(`${apiUrl}/scouting/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": entry.userId,
        },
        credentials: "include",
        body: JSON.stringify(entry.data),
      });

      const result = await response.json();

      if (result.success) {
        // Successfully submitted, remove from queue
        await removeEntry(entry.id);
        synced++;
      } else {
        // API returned error
        failed++;
        errors.push(`Match ${entry.data.matchNumber}: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      // Network or other error
      failed++;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Match ${entry.data.matchNumber}: ${errorMsg}`);
    }
  }

  return { synced, failed, errors };
}

/**
 * Clear all entries from the queue (use with caution!)
 */
export async function clearQueue(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}
