import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getLatestSnapshot,
  getSnapshot,
  listSnapshotSummaries,
  listSnapshots,
  saveSnapshot,
  type MasterySnapshot,
} from './masterySnapshots';

type StoredValue = MasterySnapshot;

class FakeRequest<T> {
  result!: T;
  error: Error | null = null;
  onsuccess: ((this: IDBRequest<T>, event: Event) => void) | null = null;
  onerror: ((this: IDBRequest<T>, event: Event) => void) | null = null;
}

class FakeObjectStore {
  constructor(
    private readonly values: Map<string, StoredValue>,
    private readonly transaction: FakeTransaction,
  ) {}

  put(value: StoredValue): IDBRequest<StoredValue> {
    const request = new FakeRequest<StoredValue>();

    queueMicrotask(() => {
      this.values.set(value.snapshotId, structuredClone(value));
      request.result = value;
      request.onsuccess?.call(request as unknown as IDBRequest<StoredValue>, new Event('success'));
      this.transaction.finish();
    });

    return request as unknown as IDBRequest<StoredValue>;
  }

  getAll(): IDBRequest<StoredValue[]> {
    const request = new FakeRequest<StoredValue[]>();

    queueMicrotask(() => {
      request.result = [...this.values.values()].map((value) => structuredClone(value));
      request.onsuccess?.call(request as unknown as IDBRequest<StoredValue[]>, new Event('success'));
      this.transaction.finish();
    });

    return request as unknown as IDBRequest<StoredValue[]>;
  }

  get(key: string): IDBRequest<StoredValue | undefined> {
    const request = new FakeRequest<StoredValue | undefined>();

    queueMicrotask(() => {
      const value = this.values.get(key);
      request.result = value ? structuredClone(value) : undefined;
      request.onsuccess?.call(request as unknown as IDBRequest<StoredValue | undefined>, new Event('success'));
      this.transaction.finish();
    });

    return request as unknown as IDBRequest<StoredValue | undefined>;
  }
}

class FakeTransaction {
  onabort: ((this: IDBTransaction, event: Event) => void) | null = null;
  oncomplete: ((this: IDBTransaction, event: Event) => void) | null = null;
  error: Error | null = null;

  constructor(private readonly values: Map<string, StoredValue>) {}

  objectStore(): IDBObjectStore {
    return new FakeObjectStore(this.values, this) as unknown as IDBObjectStore;
  }

  finish(): void {
    queueMicrotask(() => {
      this.oncomplete?.call(this as unknown as IDBTransaction, new Event('complete'));
    });
  }
}

class FakeDatabase {
  objectStoreNames = {
    contains: (name: string) => name === 'masterySnapshots',
  } as DOMStringList;

  constructor(private readonly values: Map<string, StoredValue>) {}

  createObjectStore(): IDBObjectStore {
    return {} as IDBObjectStore;
  }

  transaction(): IDBTransaction {
    return new FakeTransaction(this.values) as unknown as IDBTransaction;
  }

  close(): void {}
}

class FakeOpenRequest {
  result: IDBDatabase;
  error: Error | null = null;
  onsuccess: ((this: IDBOpenDBRequest, event: Event) => void) | null = null;
  onerror: ((this: IDBOpenDBRequest, event: Event) => void) | null = null;
  onupgradeneeded: ((this: IDBOpenDBRequest, event: IDBVersionChangeEvent) => void) | null = null;

  constructor(database: IDBDatabase) {
    this.result = database;
  }
}

function createFakeIndexedDb(seedValues: StoredValue[] = []): IDBFactory {
  const values = new Map(seedValues.map((value) => [value.snapshotId, structuredClone(value)]));

  return {
    open() {
      const request = new FakeOpenRequest(new FakeDatabase(values) as unknown as IDBDatabase);

      queueMicrotask(() => {
        request.onupgradeneeded?.call(
          request as unknown as IDBOpenDBRequest,
          new Event('upgradeneeded') as IDBVersionChangeEvent,
        );
        request.onsuccess?.call(request as unknown as IDBOpenDBRequest, new Event('success'));
      });

      return request as unknown as IDBOpenDBRequest;
    },
  } as IDBFactory;
}

function createSnapshot(overrides: Partial<MasterySnapshot>): MasterySnapshot {
  return {
    snapshotId: overrides.snapshotId ?? 'snapshot-1',
    createdAt: overrides.createdAt ?? '2026-03-18T12:00:00.000Z',
    rawText: overrides.rawText ?? 'Raw mastery export',
    masteryByItem: overrides.masteryByItem ?? { apple: 10_000 },
    parseSummary: overrides.parseSummary ?? {
      itemsParsed: 1,
      parsedRowsCount: 1,
      duplicateRowsCount: 0,
      skippedNonItemLinesCount: 0,
      skippedNonItemLineSamples: [],
      tiersDetected: [10_000],
      unknownItemsCount: 0,
      warnings: [],
    },
    parsedRows: overrides.parsedRows ?? [],
    savedAt: overrides.savedAt,
    importedAt: overrides.importedAt,
  };
}

describe('masterySnapshots storage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves multiple snapshots and returns newest-first summaries with saved/imported metadata', async () => {
    vi.stubGlobal('indexedDB', createFakeIndexedDb());

    await saveSnapshot(
      createSnapshot({
        snapshotId: 'snapshot-older',
        createdAt: '2026-03-17T12:00:00.000Z',
      }),
    );
    await saveSnapshot(
      createSnapshot({
        snapshotId: 'snapshot-newer',
        createdAt: '2026-03-18T12:00:00.000Z',
        importedAt: '2026-03-18T11:55:00.000Z',
      }),
    );

    const snapshots = await listSnapshots();
    const summaries = await listSnapshotSummaries();
    const latestSnapshot = await getLatestSnapshot();

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((snapshot) => snapshot.snapshotId)).toEqual(['snapshot-newer', 'snapshot-older']);
    expect(summaries).toEqual([
      {
        snapshotId: 'snapshot-newer',
        createdAt: '2026-03-18T12:00:00.000Z',
        savedAt: '2026-03-18T12:00:00.000Z',
        importedAt: '2026-03-18T11:55:00.000Z',
        itemCount: 1,
        parsedRowsCount: 1,
      },
      {
        snapshotId: 'snapshot-older',
        createdAt: '2026-03-17T12:00:00.000Z',
        savedAt: '2026-03-17T12:00:00.000Z',
        importedAt: '2026-03-17T12:00:00.000Z',
        itemCount: 1,
        parsedRowsCount: 1,
      },
    ]);
    expect(latestSnapshot?.snapshotId).toBe('snapshot-newer');
    expect(latestSnapshot?.savedAt).toBe('2026-03-18T12:00:00.000Z');
    expect(latestSnapshot?.importedAt).toBe('2026-03-18T11:55:00.000Z');
  });

  it('can retrieve an individual snapshot by stable identifier', async () => {
    vi.stubGlobal(
      'indexedDB',
      createFakeIndexedDb([
        createSnapshot({
          snapshotId: 'snapshot-lookup',
          createdAt: '2026-03-18T14:00:00.000Z',
          savedAt: '2026-03-18T14:05:00.000Z',
          importedAt: '2026-03-18T13:55:00.000Z',
        }),
      ]),
    );

    const snapshot = await getSnapshot('snapshot-lookup');

    expect(snapshot).toMatchObject({
      snapshotId: 'snapshot-lookup',
      createdAt: '2026-03-18T14:05:00.000Z',
      savedAt: '2026-03-18T14:05:00.000Z',
      importedAt: '2026-03-18T13:55:00.000Z',
    });
  });

  it('hydrates legacy snapshots that only stored createdAt', async () => {
    vi.stubGlobal(
      'indexedDB',
      createFakeIndexedDb([
        createSnapshot({
          snapshotId: 'snapshot-legacy',
          createdAt: '2026-03-16T09:00:00.000Z',
          savedAt: undefined,
          importedAt: undefined,
        }),
      ]),
    );

    const snapshot = await getSnapshot('snapshot-legacy');

    expect(snapshot).toMatchObject({
      snapshotId: 'snapshot-legacy',
      createdAt: '2026-03-16T09:00:00.000Z',
      savedAt: '2026-03-16T09:00:00.000Z',
      importedAt: '2026-03-16T09:00:00.000Z',
    });
  });
});
