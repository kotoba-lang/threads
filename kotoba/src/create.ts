/**
 * Create a thread post via @etzhayyim/sdk.
 *
 * The writer's DID + PDS auth come from env; the SBT-gating policy
 * (only adherents may write under their DID) is enforced at the PDS
 * write-handler layer — this CLI is a thin shim that builds the
 * record, validates it locally, and pushes via SDK.
 *
 * Usage:
 *   pnpm tsx src/create.ts --text="Hello, world."
 *   pnpm tsx src/create.ts --text="reply text" \
 *     --replyRootUri=at://did:web:.../com.etzhayyim.apps.threads.post/abc \
 *     --replyRootCid=bafy... \
 *     --replyParentUri=at://... \
 *     --replyParentCid=bafy...
 *   pnpm tsx src/create.ts --text="…" --langs=ja,en --tags=keigo,sutra
 */

import { Etzhayyim } from "@etzhayyim/sdk";
import { buildPostRecord, type ReplyRef } from "./types.js";

const COLLECTION = "com.etzhayyim.apps.threads.post";

const e = new Etzhayyim({
  did: process.env.ETZ_WRITER_DID ?? "did:web:etzhayyim.com",
  pdsUrl: process.env.ETZ_PDS_URL ?? "https://pds.etzhayyim.com",
  ipfsApiUrl: process.env.ETZ_IPFS_API_URL,
  l2RpcUrl: process.env.ETZ_L2_RPC_URL ?? "https://mainnet.base.org",
  anchorContract:
    (process.env.ETZ_ANCHOR_CONTRACT as `0x${string}` | undefined) ?? undefined,
});

interface Args {
  text?: string;
  langs?: string;
  tags?: string;
  replyRootUri?: string;
  replyRootCid?: string;
  replyParentUri?: string;
  replyParentCid?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (const a of argv) {
    const m = a.match(/^--(\w+)(?:=(.*))?$/);
    if (!m) continue;
    const [, k, v] = m;
    (out as Record<string, string | undefined>)[k] = v;
  }
  return out;
}

export function replyRefFromArgs(args: Args): ReplyRef | undefined {
  const hasAny =
    args.replyRootUri ||
    args.replyRootCid ||
    args.replyParentUri ||
    args.replyParentCid;
  if (!hasAny) return undefined;
  if (
    !args.replyRootUri ||
    !args.replyRootCid ||
    !args.replyParentUri ||
    !args.replyParentCid
  ) {
    throw new Error(
      "[create] reply requires all 4 fields: replyRootUri, replyRootCid, replyParentUri, replyParentCid",
    );
  }
  return {
    root: { uri: args.replyRootUri, cid: args.replyRootCid },
    parent: { uri: args.replyParentUri, cid: args.replyParentCid },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.text === undefined) {
    console.error("[create] missing --text");
    process.exit(1);
  }
  const record = buildPostRecord({
    text: args.text,
    reply: replyRefFromArgs(args),
    langs: args.langs ? args.langs.split(",").map((s) => s.trim()) : undefined,
    tags: args.tags ? args.tags.split(",").map((s) => s.trim()) : undefined,
  });
  const receipt = await e.write({
    collection: COLLECTION,
    record: record as unknown as Record<string, unknown>,
  });
  console.log(JSON.stringify(receipt, null, 2));
}

const isMainModule =
  import.meta.url.startsWith("file:") &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMainModule) {
  main().catch((err) => {
    console.error("[create] fatal:", err);
    process.exit(2);
  });
}
