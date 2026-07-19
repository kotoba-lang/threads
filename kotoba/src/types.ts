/**
 * Mirrors the com.etzhayyim.apps.threads.post Lexicon record shape.
 * Source: 00-contracts/lexicons/com/etzhayyim/apps/threads/post.json
 */
export interface StrongRef {
  uri: string;
  cid: string;
}

export interface ReplyRef {
  root: StrongRef;
  parent: StrongRef;
}

export interface ThreadsPost {
  /** Primary post content. Empty allowed only when reply is present. */
  text: string;

  /** Reply target — both root + parent required when present. */
  reply?: ReplyRef;

  /** BCP-47 language tags. Max 3. */
  langs?: string[];

  /** Author-chosen tags. Max 8, each max 64 chars / 32 graphemes. */
  tags?: string[];

  /** ISO datetime when the post was originally written. */
  createdAt: string;
}

/** Lexicon limits (must match post.json). */
export const TEXT_MAX_CHARS = 3000;
export const TEXT_MAX_GRAPHEMES = 500;
export const TAGS_MAX_COUNT = 8;
export const TAG_MAX_CHARS = 64;
export const TAG_MAX_GRAPHEMES = 32;
export const LANGS_MAX_COUNT = 3;

/**
 * Count user-perceived grapheme clusters in a string (≥ 1 codepoint each).
 * Uses Intl.Segmenter when available — required for CJK + emoji + ZWJ
 * sequences ("👨‍👩‍👧" must count as 1 grapheme, not 5). Falls back to
 * the codepoint count when Intl.Segmenter isn't available (Node 16-),
 * with a console warning so the fallback is observable in production.
 */
export function countGraphemes(s: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let n = 0;
    for (const _ of seg.segment(s)) n += 1;
    return n;
  }
  // Fallback — codepoint count (over-counts ZWJ sequences but under-budget).
  return [...s].length;
}

export interface PostValidationError {
  field: "text" | "langs" | "tags" | "reply";
  reason: string;
}

/**
 * Validate a post payload against the lexicon limits. Returns the list
 * of errors; an empty list means the post is well-formed. The substrate
 * write path (`@etzhayyim/sdk.write`) re-validates on the way out — this
 * helper exists so callers can surface clear errors before paying for
 * a round-trip.
 */
export function validatePost(post: ThreadsPost): PostValidationError[] {
  const errs: PostValidationError[] = [];

  // Empty text allowed only when reply is present (silent witness pattern).
  if (post.text.length === 0 && !post.reply) {
    errs.push({ field: "text", reason: "empty text requires reply context" });
  }
  if (post.text.length > TEXT_MAX_CHARS) {
    errs.push({
      field: "text",
      reason: `text exceeds ${TEXT_MAX_CHARS} chars (got ${post.text.length})`,
    });
  }
  const graphemes = countGraphemes(post.text);
  if (graphemes > TEXT_MAX_GRAPHEMES) {
    errs.push({
      field: "text",
      reason: `text exceeds ${TEXT_MAX_GRAPHEMES} graphemes (got ${graphemes})`,
    });
  }

  if (post.langs) {
    if (post.langs.length > LANGS_MAX_COUNT) {
      errs.push({
        field: "langs",
        reason: `too many langs (max ${LANGS_MAX_COUNT}, got ${post.langs.length})`,
      });
    }
    for (const lang of post.langs) {
      if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(lang)) {
        errs.push({ field: "langs", reason: `invalid BCP-47 tag: "${lang}"` });
      }
    }
  }

  if (post.tags) {
    if (post.tags.length > TAGS_MAX_COUNT) {
      errs.push({
        field: "tags",
        reason: `too many tags (max ${TAGS_MAX_COUNT}, got ${post.tags.length})`,
      });
    }
    for (const tag of post.tags) {
      if (tag.length > TAG_MAX_CHARS) {
        errs.push({
          field: "tags",
          reason: `tag exceeds ${TAG_MAX_CHARS} chars: "${tag.slice(0, 32)}…"`,
        });
      }
      if (countGraphemes(tag) > TAG_MAX_GRAPHEMES) {
        errs.push({
          field: "tags",
          reason: `tag exceeds ${TAG_MAX_GRAPHEMES} graphemes`,
        });
      }
    }
  }

  if (post.reply) {
    if (!post.reply.root?.uri || !post.reply.root?.cid) {
      errs.push({ field: "reply", reason: "reply.root requires both uri and cid" });
    }
    if (!post.reply.parent?.uri || !post.reply.parent?.cid) {
      errs.push({ field: "reply", reason: "reply.parent requires both uri and cid" });
    }
  }

  return errs;
}

/**
 * Build a record body suitable for `e.write({ collection, record })`.
 * Adds `createdAt` if absent. Throws on validation errors so the caller
 * can't accidentally write a malformed record.
 */
export function buildPostRecord(
  input: Omit<ThreadsPost, "createdAt"> & { createdAt?: string },
): ThreadsPost {
  const post: ThreadsPost = {
    text: input.text,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  if (input.reply) post.reply = input.reply;
  if (input.langs && input.langs.length > 0) post.langs = input.langs;
  if (input.tags && input.tags.length > 0) post.tags = input.tags;
  const errs = validatePost(post);
  if (errs.length > 0) {
    throw new Error(
      `[threads] invalid post: ${errs.map((e) => `${e.field}: ${e.reason}`).join("; ")}`,
    );
  }
  return post;
}
