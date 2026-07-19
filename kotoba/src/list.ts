/**
 * List recent thread posts by a DID via @etzhayyim/sdk.read().
 *
 * Posts use rkey=tid (timestamp-based AT-Protocol record key), so a
 * full-collection read returns posts in reverse-chronological order.
 *
 * Usage:
 *   pnpm tsx src/list.ts --did=did:web:etzhayyim.com
 *   pnpm tsx src/list.ts --did=... --limit=20
 */

import { Etzhayyim } from "@etzhayyim/sdk";
import type { ThreadsPost } from "./types.js";

const COLLECTION = "com.etzhayyim.apps.threads.post";

const e = new Etzhayyim({
  did: process.env.ETZ_READER_DID ?? "did:web:etzhayyim.com",
  pdsUrl: process.env.ETZ_PDS_URL ?? "https://pds.etzhayyim.com",
  ipfsGateway: process.env.ETZ_IPFS_GATEWAY ?? "https://ipfs.etzhayyim.com",
  l2RpcUrl: process.env.ETZ_L2_RPC_URL ?? "https://mainnet.base.org",
});

interface Args {
  limit?: number;
  fetchBlobs?: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (const a of argv) {
    const m = a.match(/^--(\w+)(?:=(.*))?$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "limit") out.limit = Number(v);
    else if (k === "fetchBlobs") out.fetchBlobs = v !== "false";
    else (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { records, cursor } = await e.read<ThreadsPost>({
    collection: COLLECTION,
    limit: args.limit ?? 50,
    fetchBlobs: args.fetchBlobs ?? false,
  });
  console.log(`[list] ${process.env.ETZ_READER_DID ?? "did:web:etzhayyim.com"} → ${records.length} posts`);
  for (const r of records) {
    const preview = r.value.text.slice(0, 80).replace(/\n/g, " ");
    const reply = r.value.reply ? " [reply]" : "";
    console.log(`  ${r.value.createdAt}  ${preview}${reply}`);
  }
  if (cursor) console.log(`[list] next cursor: ${cursor}`);
}

const isMainModule =
  import.meta.url.startsWith("file:") &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMainModule) {
  main().catch((err) => {
    console.error("[list] fatal:", err);
    process.exit(2);
  });
}
