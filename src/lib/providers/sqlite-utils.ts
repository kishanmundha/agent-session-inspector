import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "url";
import { statOf } from "./fs-utils";

/**
 * Runs `read` against an agent's SQLite store without ever writing to it.
 * Null when the store is missing, locked, or not the schema `read` expects.
 */
export function readDatabase<T>(dbPath: string, read: (db: DatabaseSync) => T): T | null {
  if (!statOf(dbPath)) return null;
  // A store in WAL mode needs its directory writable even to read. When it is
  // not (a read-only Docker mount), fall back to the main file alone, which
  // misses only what the agent has not checkpointed yet.
  for (const location of [dbPath, `${pathToFileURL(dbPath).href}?immutable=1`]) {
    let db: DatabaseSync | null = null;
    try {
      db = new DatabaseSync(location, { readOnly: true });
      return read(db);
    } catch {
      /* try the next way in */
    } finally {
      try {
        db?.close();
      } catch {
        /* already closed */
      }
    }
  }
  return null;
}

/** Rows of a query, typed by the caller. */
export function rows<T>(db: DatabaseSync, sql: string, ...params: (string | number)[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

/**
 * Memoizes a read of the whole store, keyed on the database and its
 * write-ahead log so a session in progress is picked up.
 */
export function createDatabaseCache<T>(dbPath: string, compute: () => T) {
  let cached: { key: string; value: T } | null = null;
  return (): T => {
    const key = [dbPath, `${dbPath}-wal`]
      .map((file) => {
        const stat = statOf(file);
        return stat ? `${stat.mtimeMs}:${stat.size}` : "missing";
      })
      .join("|");
    if (cached?.key !== key) cached = { key, value: compute() };
    return cached.value;
  };
}
