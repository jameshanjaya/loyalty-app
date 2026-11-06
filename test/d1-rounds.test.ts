import { describe, expect, it } from "vitest";
import { clearReadCache, loadHadiahBundle, loadKartuBundle, loadProfilBundle } from "../src/fast-read";
import { handleCustomer } from "../src/routes/customer";
import type { App } from "../src/routes/customer";

/**
 * Before this change, /kartu awaited about 68 sequential D1 calls
 * (three brands × missions × outlets × ensureCard). Owner timing: ~263ms
 * per round trip from Singapore to a US D1, about 17s.
 * After: the steady path is one member read plus one batch.
 */
const BEFORE = { kartu: 68, hadiah: 8, profil: 6, kasir: 4, admin: 20 };

class CountDb {
  rounds = 0;
  prepare(sql: string) {
    const stmt = {
      sql,
      bind: () => stmt,
      first: async () => {
        this.rounds += 1;
        return null;
      },
      all: async () => {
        this.rounds += 1;
        return { results: [] };
      },
      run: async () => {
        this.rounds += 1;
        return { meta: { changes: 0 } };
      },
    };
    return stmt;
  }
  async batch(statements: Array<{ sql: string }>) {
    this.rounds += 1;
    return statements.map((stmt) => ({ results: rowsFor(stmt.sql) }));
  }
}

function rowsFor(sql: string): unknown[] {
  const table = /FROM\s+(\w+)/.exec(sql)?.[1] || "";
  if (table === "brands") {
    return [
      {
        id: "loft25",
        name: "Loft25",
        short_name: "Loft25",
        handle: "@loft25",
        emoji: "🍵",
        accent: "#143d28",
        accent_soft: "#e4f0dc",
        stamps_required: 10,
        reward_text: "free matcha",
        condition_label: "ok",
        min_amount: null,
        max_stamps_per_day: 2,
        reward_note: "",
        active: 1,
        birthday_reward: "free",
        birthday_active: 1,
        birthday_window: "day",
        birthday_days: 0,
        page_bg: "#f4efe4",
        cta: "#143d28",
      },
    ];
  }
  if (table === "cards") {
    return [{ member_id: "m1", brand_id: "loft25", stamps: 3, lifetime_stamps: 3, lifetime_redeems: 0, remainder_quarters: 0, day_count: 0, day_on: 0, updated_at: 1 }];
  }
  if (table === "settings") return [{ key: "wa_verify_lock", value: "0" }, { key: "referral_batch", value: "4" }];
  if (sql.includes("SUM(delta_tenths)")) return [{ n: 0 }];
  if (sql.includes("COUNT(*)")) return [{ n: 1 }];
  return [];
}

const memberSql = `SELECT m.*, s.expires_at AS __exp FROM sessions s JOIN members m`;

describe("D1 round trips", () => {
  it("records the measured before counts", () => {
    expect(BEFORE.kartu).toBeGreaterThan(4);
  });

  it("loads /kartu, /hadiah, and /profil in at most 4 round trips when the card exists", async () => {
    clearReadCache();
    const db = new CountDb();
    const member = await db
      .prepare(memberSql)
      .bind("sid", Date.now())
      .first();
    expect(member).toBeNull();
    const afterMember = db.rounds;
    const kartu = await loadKartuBundle(db as unknown as D1Database, "m1", "loft25", Date.now(), "", null);
    expect(kartu?.brand.id).toBe("loft25");
    expect(kartu?.card).toBeTruthy();
    expect(db.rounds - afterMember).toBe(1);
    expect(db.rounds).toBeLessThanOrEqual(4);

    const hadiahStart = db.rounds;
    const hadiah = await loadHadiahBundle(db as unknown as D1Database, "m1", "loft25", Date.now(), "1998-11-04");
    expect(hadiah?.stamps).toBe(3);
    expect(db.rounds - hadiahStart).toBe(1);

    const profilStart = db.rounds;
    const profil = await loadProfilBundle(db as unknown as D1Database, "m1", "loft25", Date.now());
    expect(profil.brand?.id).toBe("loft25");
    expect(db.rounds - profilStart).toBe(1);
  });

  it("serves a logged-in /kartu without a per-brand ensure write", async () => {
    clearReadCache();
    const db = new CountDb();
    const request = new Request("https://loyalty.example/kartu?merek=loft25", { headers: { cookie: "lb_member=sid" } });
    db.prepare = ((sql: string) => {
      const stmt = {
        sql,
        bind: () => stmt,
        first: async () => {
          db.rounds += 1;
          if (sql.includes("FROM sessions")) {
            return {
              id: "m1",
              name: "Budi Santoso",
              wa: "6281298760007",
              pin_hash: "x",
              pin_salt: "y",
              created_at: 1,
              last_seen_at: 1,
              email: null,
              birthday: null,
              google_sub: null,
              join_method: "wa",
              wa_verified: 1,
              referral_code: "budi123",
              __exp: Date.now() + 86_400_000,
            };
          }
          return null;
        },
        all: async () => {
          db.rounds += 1;
          return { results: rowsFor(sql) };
        },
        run: async () => {
          db.rounds += 1;
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    }) as CountDb["prepare"];
    const response = await handleCustomer({
      request,
      env: { DB: db, TOKEN_SECRET: "", WA_BUSINESS_NUMBER: "", WA_VERIFY_TOKEN: "", WA_ACCESS_TOKEN: "", WA_APP_SECRET: "", WA_OTP_ENABLED: "" } as unknown as App["env"],
      url: new URL(request.url),
      now: Date.now(),
      ip: "127.0.0.1",
      ctx: { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext,
    });
    expect(response?.status).toBe(200);
    const html = await response?.text();
    expect(html).toContain("Collect Stamps");
    expect(html).toContain("rail solo");
    expect(db.rounds).toBeLessThanOrEqual(4);
    expect(db.rounds).toBeGreaterThan(0);
  });
});
