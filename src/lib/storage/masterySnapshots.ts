import type { ParsedRow, ParseSummary } from '../parseMasteryPaste';

export type MasterySnapshot = {
  snapshotId: string;
  createdAt: string;
  savedAt?: string;
  importedAt?: string;
  rawText: string;
  masteryByItem: Record<string, number>;
  parseSummary: ParseSummary;
  parsedRows?: ParsedRow[];
};

export type MasterySnapshotSummary = {
  snapshotId: string;
  createdAt: string;
  savedAt: string;
  importedAt: string;
  itemCount: number;
  parsedRowsCount: number;
};

const DB_NAME = 'farmrpg-tools';
const DB_VERSION = 1;
const SNAPSHOT_STORE_NAME = 'masterySnapshots';

function createStorageError(): Error {
  return new Error('IndexedDB is not available in this browser.');
}

function normalizeSnapshot(snapshot: MasterySnapshot): MasterySnapshot {
  const savedAt = snapshot.savedAt ?? snapshot.createdAt;
  const importedAt = snapshot.importedAt ?? savedAt;

  return {
    ...snapshot,
    createdAt: savedAt,
    savedAt,
    importedAt,
  };
}

function toSnapshotSummary(snapshot: MasterySnapshot): MasterySnapshotSummary {
  const normalizedSnapshot = normalizeSnapshot(snapshot);

  return {
    snapshotId: normalizedSnapshot.snapshotId,
    createdAt: normalizedSnapshot.createdAt,
    savedAt: normalizedSnapshot.savedAt ?? normalizedSnapshot.createdAt,
    importedAt: normalizedSnapshot.importedAt ?? normalizedSnapshot.createdAt,
    itemCount: normalizedSnapshot.parseSummary.itemsParsed,
    parsedRowsCount: normalizedSnapshot.parseSummary.parsedRowsCount,
  };
}

function getIndexedDb(): IDBFactory {
  if (!('indexedDB' in globalThis)) {
    throw createStorageError();
  }

  return globalThis.indexedDB;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let indexedDb: IDBFactory;

    try {
      indexedDb = getIndexedDb();
    } catch (error) {
      reject(error);
      return;
    }

    const request = indexedDb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) {
        database.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: 'snapshotId' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Unable to open local snapshot storage.'));
    };
  });
}

function runStoreRequest<T>(
  mode: IDBTransactionMode,
  execute: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(SNAPSHOT_STORE_NAME, mode);
        const store = transaction.objectStore(SNAPSHOT_STORE_NAME);
        const request = execute(store);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error ?? new Error('Snapshot storage request failed.'));
        };

        transaction.onabort = () => {
          reject(transaction.error ?? new Error('Snapshot storage transaction was aborted.'));
        };

        transaction.oncomplete = () => {
          database.close();
        };
      }),
  );
}

function runStoreTransaction(
  mode: IDBTransactionMode,
  execute: (store: IDBObjectStore) => void,
): Promise<void> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(SNAPSHOT_STORE_NAME, mode);
        const store = transaction.objectStore(SNAPSHOT_STORE_NAME);

        try {
          execute(store);
        } catch (error) {
          database.close();
          reject(error);
          return;
        }

        transaction.onabort = () => {
          reject(transaction.error ?? new Error('Snapshot storage transaction was aborted.'));
        };

        transaction.onerror = () => {
          reject(transaction.error ?? new Error('Snapshot storage transaction failed.'));
        };

        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
      }),
  );
}

function sortSnapshotsNewestFirst(snapshots: MasterySnapshot[]): MasterySnapshot[] {
  return [...snapshots]
    .map(normalizeSnapshot)
    .sort((left, right) => {
      const savedAtComparison = (right.savedAt ?? right.createdAt).localeCompare(left.savedAt ?? left.createdAt);

      if (savedAtComparison !== 0) {
        return savedAtComparison;
      }

      return right.snapshotId.localeCompare(left.snapshotId);
    });
}

export function createSnapshotId(): string {
  if ('crypto' in globalThis && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `snapshot-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function saveSnapshot(snapshot: MasterySnapshot): Promise<void> {
  await runStoreRequest('readwrite', (store) => store.put(normalizeSnapshot(snapshot)));
}

export async function replaceSnapshots(snapshots: MasterySnapshot[]): Promise<void> {
  const normalizedSnapshots = snapshots.map(normalizeSnapshot);

  await runStoreTransaction('readwrite', (store) => {
    store.clear();

    normalizedSnapshots.forEach((snapshot) => {
      store.put(snapshot);
    });
  });
}

export async function listSnapshots(): Promise<MasterySnapshot[]> {
  const snapshots = await runStoreRequest('readonly', (store) => store.getAll());
  return sortSnapshotsNewestFirst(snapshots);
}

export async function listSnapshotSummaries(): Promise<MasterySnapshotSummary[]> {
  const snapshots = await listSnapshots();
  return snapshots.map(toSnapshotSummary);
}

export async function getSnapshot(snapshotId: string): Promise<MasterySnapshot | null> {
  const snapshot = await runStoreRequest('readonly', (store) => store.get(snapshotId));
  return snapshot ? normalizeSnapshot(snapshot) : null;
}

export async function getLatestSnapshot(): Promise<MasterySnapshot | null> {
  const snapshots = await listSnapshots();
  return snapshots[0] ?? null;
}
