/**
 * Tests for the CLI's argument → ReplyRef parser. No SDK / network.
 * Locks down the "all 4 fields or none" invariant for reply args.
 */

import { describe, expect, it } from "vitest";

import { replyRefFromArgs } from "./create.js";

describe("replyRefFromArgs", () => {
  it("returns undefined when no reply args are present", () => {
    expect(replyRefFromArgs({})).toBeUndefined();
  });

  it("returns a complete ReplyRef when all 4 fields are present", () => {
    const out = replyRefFromArgs({
      replyRootUri: "at://x/y/r",
      replyRootCid: "bafyR",
      replyParentUri: "at://x/y/p",
      replyParentCid: "bafyP",
    });
    expect(out).toEqual({
      root: {uri: "at://x/y/r", cid: "bafyR"},
      parent: {uri: "at://x/y/p", cid: "bafyP"},
    });
  });

  it.each([
    {replyRootUri: "at://x/y/r"},
    {replyRootUri: "at://x/y/r", replyRootCid: "bafyR"},
    {
      replyRootUri: "at://x/y/r",
      replyRootCid: "bafyR",
      replyParentUri: "at://x/y/p",
    },
  ])("throws when partial reply args are given: %j", (args) => {
    expect(() => replyRefFromArgs(args)).toThrow(/all 4 fields/);
  });
});
