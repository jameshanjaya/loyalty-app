import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { SOURCE_BRAND_ID, TARGET_BRAND_IDS, planClone, type BrandRow, type MissionRow, type PhotoRow, type TierRow } from "../src/clone-program.ts";

const remote = process.argv.includes("--remote");
const apply = process.argv.includes("--apply");

function d1(command: string): unknown[] {
  const args = ["wrangler", "d1", "execute", "loyalty-bos", remote ? "--remote" : "--local", "--json", "--command", command];
  const run = spawnSync("npx", args, { encoding: "utf8" });
  if (run.status !== 0) {
    console.error(run.stderr || run.stdout);
    process.exit(run.status ?? 1);
  }
  const text = run.stdout;
  const start = text.indexOf("[");
  if (start < 0) {
    console.error(text);
    process.exit(1);
  }
  const parsed = JSON.parse(text.slice(start)) as Array<{ results?: unknown[] }>;
  return parsed[0]?.results ?? [];
}

function rows<T>(sql: string): T[] {
  return d1(sql) as T[];
}

const sourceRows = rows<BrandRow>(`SELECT * FROM brands WHERE id = '${SOURCE_BRAND_ID}'`);
const source = sourceRows[0];
if (!source) {
  console.error("Merek loft25 tidak ketemu.");
  process.exit(1);
}
const targets = rows<BrandRow>(`SELECT * FROM brands WHERE id IN (${TARGET_BRAND_IDS.map((id) => `'${id}'`).join(", ")})`);
const tiers = rows<TierRow>(`SELECT * FROM stamp_tiers WHERE brand_id = '${SOURCE_BRAND_ID}' ORDER BY stamps`);
const missions = rows<MissionRow>(`SELECT * FROM missions WHERE brand_id = '${SOURCE_BRAND_ID}' ORDER BY sort_order, title`);
const photos = missions.length
  ? rows<PhotoRow>(`SELECT * FROM mission_photos WHERE mission_id IN (${missions.map((mission) => `'${mission.id.replaceAll("'", "''")}'`).join(", ")}) ORDER BY sort_order`)
  : [];
const plan = planClone({ source, targets, tiers, missions, photos });

console.log(remote ? "Database: remote" : "Database: local");
console.log(apply ? "Mode: tulis" : "Mode: lihat saja. Tambah --apply untuk menulis.");
for (const line of plan.summary) console.log(`- ${line}`);
console.log("Tidak disalin: nama, warna, logo, ikon stamp, dan status aktif merek.");
if (!apply) process.exit(0);

const file = ".clone-program.sql";
writeFileSync(file, plan.sql);
const write = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", "loyalty-bos", remote ? "--remote" : "--local", "--file", file],
  { encoding: "utf8" },
);
unlinkSync(file);
if (write.stdout) console.log(write.stdout);
if (write.status !== 0) {
  console.error(write.stderr);
  process.exit(write.status ?? 1);
}
console.log("Selesai. Soto Oseng dan Krispyporkk tetap nonaktif.");
