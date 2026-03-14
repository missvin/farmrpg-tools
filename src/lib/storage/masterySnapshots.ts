import type { ParsedRow, ParseSummary } from '../parseMasteryPaste';

export type MasterySnapshot = {
  snapshotId: string;
  createdAt: string;
  rawText: string;
  masteryByItem: Record<string, number>;
  parseSummary: ParseSummary;
  parsedRows?: ParsedRow[];
};

const DB_NAME = 'farmrpg-tools';
const DB_VERSION = 1;
const SNAPSHOT_STORE_NAME = 'masterySnapshots';

function createStorageError(): Error {
  return new Error('IndexedDB is not available in this browser.');
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

function sortSnapshotsNewestFirst(snapshots: MasterySnapshot[]): MasterySnapshot[] {
  return [...snapshots].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createSnapshotId(): string {
  if ('crypto' in globalThis && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `snapshot-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function saveSnapshot(snapshot: MasterySnapshot): Promise<void> {
  await runStoreRequest('readwrite', (store) => store.put(snapshot));
}

export async function listSnapshots(): Promise<MasterySnapshot[]> {
  const snapshots = await runStoreRequest('readonly', (store) => store.getAll());
  return sortSnapshotsNewestFirst(snapshots);
}

export async function getLatestSnapshot(): Promise<MasterySnapshot | null> {
  const snapshots = await listSnapshots();
  return snapshots[0] ?? null;
}
