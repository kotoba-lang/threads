export type {
  StrongRef,
  ReplyRef,
  ThreadsPost,
  PostValidationError,
} from "./types.js";
export {
  buildPostRecord,
  countGraphemes,
  validatePost,
  TEXT_MAX_CHARS,
  TEXT_MAX_GRAPHEMES,
  TAGS_MAX_COUNT,
  TAG_MAX_CHARS,
  TAG_MAX_GRAPHEMES,
  LANGS_MAX_COUNT,
} from "./types.js";
export { replyRefFromArgs } from "./create.js";

// Programmatic entry points (in addition to the CLI bins). Apps that
// embed religious-corp thread reads/writes can import from here:
//   import { listPosts, getPostByUri } from "@etzhayyim/threads-kotoba";

import { Etzhayyim } from "@etzhayyim/sdk";
import type { ThreadsPost } from "./types.js";

const COLLECTION = "com.etzhayyim.apps.threads.post";

function defaultClient() {
  return new Etzhayyim({
    did: "did:web:etzhayyim.com",
    pdsUrl: "https://pds.etzhayyim.com",
    ipfsGateway: "https://ipfs.etzhayyim.com",
    l2RpcUrl: "https://mainnet.base.org",
  });
}

/**
 * List recent posts under the client's configured DID. To read posts
 * from a different DID, pass a client constructed with that DID's
 * config (the SDK's `read()` scopes by the client's configured DID).
 */
export async function listPosts(
  opts: { limit?: number; client?: Etzhayyim } = {},
): Promise<ThreadsPost[]> {
  const e = opts.client ?? defaultClient();
  const { records } = await e.read<ThreadsPost>({
    collection: COLLECTION,
    limit: opts.limit ?? 50,
    fetchBlobs: false,
  });
  return records.map((r) => r.value);
}

/**
 * Verify a post AT URI against the L2 anchor. Returns the verification
 * result (Merkle proof + anchor tx) — see `@etzhayyim/sdk.VerifyResult`.
 * The post body itself is fetched separately via `read({ rkey })`.
 */
export async function verifyPostUri(
  uri: string,
  opts: { client?: Etzhayyim } = {},
) {
  const e = opts.client ?? defaultClient();
  return e.verify(uri);
}
