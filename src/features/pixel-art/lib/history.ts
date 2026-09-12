export type HistoryEquality<T> = (left: T, right: T) => boolean;

export type HistoryOptions<T> = {
  equals?: HistoryEquality<T>;
  limit?: number;
};

const DEFAULT_HISTORY_LIMIT = 100;

const normalizeHistoryLimit = (limit: number | undefined) => {
  const normalizedLimit = limit ?? DEFAULT_HISTORY_LIMIT;

  if (!Number.isFinite(normalizedLimit) || normalizedLimit < 1) {
    throw new RangeError("History limit must be a positive finite number.");
  }

  return Math.floor(normalizedLimit);
};

/**
 * Immutable snapshot history. Operations never mutate this history or any
 * snapshot supplied by the caller; they return a new history when state changes.
 * Snapshots themselves should be treated as immutable values by consumers.
 */
export class SnapshotHistory<T> {
  readonly current: T;

  private readonly equals: HistoryEquality<T>;
  private readonly future: readonly T[];
  private readonly limit: number;
  private readonly past: readonly T[];

  private constructor(
    current: T,
    options: HistoryOptions<T> = {},
    past: readonly T[] = [],
    future: readonly T[] = [],
  ) {
    this.current = current;
    this.equals = options.equals ?? Object.is;
    this.limit = normalizeHistoryLimit(options.limit);
    this.past = past;
    this.future = future;
  }

  static create<T>(initialSnapshot: T, options?: HistoryOptions<T>) {
    return new SnapshotHistory(initialSnapshot, options);
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  push(snapshot: T): SnapshotHistory<T> {
    if (this.equals(this.current, snapshot)) {
      return this;
    }

    const past = [...this.past, this.current].slice(-this.limit);
    return this.withState(snapshot, past, []);
  }

  undo(): SnapshotHistory<T> {
    if (!this.canUndo) {
      return this;
    }

    const previousIndex = this.past.length - 1;
    const previous = this.past[previousIndex] as T;
    return this.withState(
      previous,
      this.past.slice(0, previousIndex),
      [this.current, ...this.future],
    );
  }

  redo(): SnapshotHistory<T> {
    if (!this.canRedo) {
      return this;
    }

    const next = this.future[0] as T;
    return this.withState(next, [...this.past, this.current], this.future.slice(1));
  }

  clear(snapshot: T = this.current): SnapshotHistory<T> {
    return this.withState(snapshot, [], []);
  }

  private withState(
    current: T,
    past: readonly T[],
    future: readonly T[],
  ): SnapshotHistory<T> {
    return new SnapshotHistory(
      current,
      { equals: this.equals, limit: this.limit },
      past,
      future,
    );
  }
}

export const createHistory = <T>(initialSnapshot: T, options?: HistoryOptions<T>) =>
  SnapshotHistory.create(initialSnapshot, options);
