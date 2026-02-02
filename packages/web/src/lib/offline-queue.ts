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
  apiUrl: string = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
): Promise<{ synced: number; failed: number; errors: string[] }> {
  if (!isOnline()) {
    return { synced: 0, failed: 0, errors: ["Device is offline"] };
  }

  const entries = await getPendingEntries();
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    try {
      const response = await fetch(`${apiUrl}/api/scouting/entries`, {
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
