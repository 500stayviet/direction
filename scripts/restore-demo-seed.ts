/**
 * 개인(비 e2e) 계정에 체험 demo 고객·매물·일정을 다시 심음.
 *
 * 사용:
 *   npm run restore:demo-seed
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { restoreDemoSeedForPersonalAccounts } from "../src/lib/adminDemoRestore";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const result = await restoreDemoSeedForPersonalAccounts(admin);
  console.log(`restore demo for ${result.ok + result.fail} personal accounts`);
  for (const u of result.restored) console.log("✓", u);
  for (const f of result.failed) console.error("✗", f.username, f.message);
  console.log(`\ndone ok=${result.ok} fail=${result.fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
