import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { DB_NAME, registerAppDbSchema } from "@firefly/db";

const dbs: Dexie[] = [];

function createDb(name: string): Dexie {
  const db = new Dexie(name);
  registerAppDbSchema(db);
  dbs.push(db);
  return db;
}

describe("db schema", () => {
  afterEach(async () => {
    await Promise.all(
      dbs.splice(0).map(async (db) => {
        db.close();
        await Dexie.delete(db.name);
      }),
    );
  });

  it("uses the Firefly browser store", () => {
    expect(DB_NAME).toBe("firefly-store");
  });

  it("registers local chat storage tables without repository state", async () => {
    const db = createDb(`firefly-schema-${String(Date.now())}`);
    await db.open();

    expect(db.tables.map((table) => table.name).sort()).toEqual([
      "daily_costs",
      "messages",
      "provider-keys",
      "session_leases",
      "session_runtime",
      "sessions",
      "settings",
    ]);
  });
});
