/**
 * Pure-helper tests — countGraphemes (CJK + emoji + ZWJ),
 * validatePost (text/langs/tags/reply boundaries), buildPostRecord
 * (defaults + throw-on-invalid).
 */

import { describe, expect, it } from "vitest";

import {
  buildPostRecord,
  countGraphemes,
  TAGS_MAX_COUNT,
  TEXT_MAX_GRAPHEMES,
  validatePost,
  type ThreadsPost,
} from "./types.js";

describe("countGraphemes", () => {
  it("counts ASCII chars 1:1", () => {
    expect(countGraphemes("hello")).toBe(5);
    expect(countGraphemes("")).toBe(0);
  });

  it("counts CJK characters 1:1", () => {
    expect(countGraphemes("こんにちは")).toBe(5);
    expect(countGraphemes("八百万")).toBe(3);
  });

  it("counts a single emoji as 1 grapheme even if it's multi-codepoint", () => {
    // 👨‍👩‍👧 = man + ZWJ + woman + ZWJ + girl = 5 codepoints, 1 grapheme.
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      expect(countGraphemes("👨‍👩‍👧")).toBe(1);
    }
  });
});

describe("validatePost", () => {
  it("accepts a minimal valid post", () => {
    const post: ThreadsPost = {
      text: "hello world",
      createdAt: "2026-05-21T12:00:00.000Z",
    };
    expect(validatePost(post)).toEqual([]);
  });

  it("rejects empty text without a reply", () => {
    const errs = validatePost({text: "", createdAt: "2026-05-21T00:00:00Z"});
    expect(errs).toContainEqual({
      field: "text",
      reason: "empty text requires reply context",
    });
  });

  it("accepts empty text when reply is present (silent witness)", () => {
    const errs = validatePost({
      text: "",
      createdAt: "2026-05-21T00:00:00Z",
      reply: {
        root: {uri: "at://x/y/r", cid: "bafyR"},
        parent: {uri: "at://x/y/p", cid: "bafyP"},
      },
    });
    expect(errs).toEqual([]);
  });

  it("rejects text over the grapheme limit", () => {
    // Use CJK so each char counts as one grapheme.
    const overlong = "あ".repeat(TEXT_MAX_GRAPHEMES + 1);
    const errs = validatePost({
      text: overlong,
      createdAt: "2026-05-21T00:00:00Z",
    });
    expect(errs.some((e) => e.field === "text" && /graphemes/.test(e.reason))).toBe(true);
  });

  it("rejects invalid BCP-47 lang tags", () => {
    const errs = validatePost({
      text: "x",
      createdAt: "2026-05-21T00:00:00Z",
      langs: ["ja", "Klingon!"],
    });
    expect(errs.some((e) => e.field === "langs" && /invalid BCP-47/.test(e.reason))).toBe(
      true,
    );
  });

  it("accepts BCP-47 tags with region subtag (ja-JP, en-US)", () => {
    const errs = validatePost({
      text: "x",
      createdAt: "2026-05-21T00:00:00Z",
      langs: ["ja-JP", "en-US"],
    });
    expect(errs).toEqual([]);
  });

  it("rejects more than 3 langs", () => {
    const errs = validatePost({
      text: "x",
      createdAt: "2026-05-21T00:00:00Z",
      langs: ["ja", "en", "fr", "de"],
    });
    expect(errs.some((e) => e.field === "langs" && /too many/.test(e.reason))).toBe(true);
  });

  it("rejects more than 8 tags", () => {
    const errs = validatePost({
      text: "x",
      createdAt: "2026-05-21T00:00:00Z",
      tags: Array.from({length: TAGS_MAX_COUNT + 1}, (_, i) => `tag${i}`),
    });
    expect(errs.some((e) => e.field === "tags" && /too many/.test(e.reason))).toBe(true);
  });

  it("rejects reply with missing root.cid", () => {
    const errs = validatePost({
      text: "ok",
      createdAt: "2026-05-21T00:00:00Z",
      reply: {
        root: {uri: "at://x/y/r", cid: ""},
        parent: {uri: "at://x/y/p", cid: "bafyP"},
      },
    });
    expect(errs.some((e) => e.field === "reply")).toBe(true);
  });

  it("rejects reply with missing parent", () => {
    const errs = validatePost({
      text: "ok",
      createdAt: "2026-05-21T00:00:00Z",
      reply: {
        root: {uri: "at://x/y/r", cid: "bafyR"},
        parent: {uri: "", cid: ""},
      },
    });
    expect(errs.some((e) => e.field === "reply")).toBe(true);
  });
});

describe("buildPostRecord", () => {
  it("defaults createdAt to now when absent", () => {
    const before = Date.now();
    const post = buildPostRecord({text: "hello"});
    const after = Date.now();
    const ts = Date.parse(post.createdAt);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("preserves explicit createdAt", () => {
    const post = buildPostRecord({
      text: "hello",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    expect(post.createdAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("strips empty optional arrays (langs / tags)", () => {
    const post = buildPostRecord({text: "x", langs: [], tags: []});
    expect("langs" in post).toBe(false);
    expect("tags" in post).toBe(false);
  });

  it("throws when post is invalid", () => {
    expect(() => buildPostRecord({text: ""})).toThrow(/invalid post/);
    expect(() =>
      buildPostRecord({text: "あ".repeat(TEXT_MAX_GRAPHEMES + 1)}),
    ).toThrow(/invalid post/);
  });

  it("carries reply ref through", () => {
    const post = buildPostRecord({
      text: "",
      reply: {
        root: {uri: "at://x/y/r", cid: "bafyR"},
        parent: {uri: "at://x/y/p", cid: "bafyP"},
      },
    });
    expect(post.reply?.root.cid).toBe("bafyR");
    expect(post.reply?.parent.cid).toBe("bafyP");
  });
});
