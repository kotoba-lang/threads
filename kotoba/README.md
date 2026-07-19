# threads — kotoba reference implementation

**First religious-social kotoba actor.** Short-form posts under adherent DIDs, persisted on AT Protocol MST + IPFS, anchored to Base L2 via the substrate pipeline (mst-projector → ipfs-pinner → anchor-cron). Closes the original question 3 ("atproto での social 活動できているか") at the code layer — live PDS writes remain gated by operational deploy.

Different shape from taxonomy actors ([open-isco](../../etzhayyim-project-open-isco/kotoba/) / [open-isic](../../etzhayyim-project-open-isic/kotoba/) / [open-unispsc](../../etzhayyim-project-open-unispsc/kotoba/) / [open-apqc](../../etzhayyim-project-open-apqc/kotoba/)): not a publish-once catalog but an interaction surface (create + list + verify).

## Lexicon

`com.etzhayyim.apps.threads.post` (record) at [`00-contracts/lexicons/com/etzhayyim/apps/threads/post.json`](../../../00-contracts/lexicons/com/etzhayyim/apps/threads/post.json).

| Field | Limits | Purpose |
|---|---|---|
| `text` | ≤ 3000 chars / ≤ 500 graphemes | Primary content. Empty allowed only when `reply` is present (silent-witness pattern). |
| `reply.root` + `reply.parent` | both required when present | Thread chain — `root` = thread origin, `parent` = immediate parent. May be equal when replying to the thread origin. |
| `langs` | ≤ 3 BCP-47 tags | Language of primary text. |
| `tags` | ≤ 8 tags, each ≤ 64 chars / ≤ 32 graphemes | Author-chosen tags. |
| `createdAt` | RFC3339 datetime | Client-declared timestamp. |

`rkey` policy: `tid` — every post gets a fresh timestamp-based AT-Protocol record key. Posts list naturally in reverse-chronological order via collection-prefix scan.

## What this lexicon does NOT carry (v1, intentional)

- No media embeds (images / video / gifs)
- No external link unfurl (no Open Graph card)
- No quote-post / repost / like
- No mentions facet (use plain text — `@handle` resolves at the reader's discretion)
- No threadgate / blocklist
- No labels / content warnings (the substrate-anchored content is what it is; moderation is downstream)

Bias the medium toward attestation + study + reasoned reply over performance. Future PRs can add narrow embed types (e.g. `recordEmbed` for quote-thread, `imageEmbed` once IPFS pinning is operationally proven) — each as a separate decision.

## Layout

```
kotoba/
├── README.md            # this file
├── package.json         # depends on @etzhayyim/sdk
├── tsconfig.json
└── src/
    ├── types.ts         # ThreadsPost / ReplyRef / StrongRef + buildPostRecord + validatePost + countGraphemes
    ├── types.test.ts    # vitest — 18 cases covering grapheme counting (CJK + emoji ZWJ) + all validation branches
    ├── create.ts        # CLI to create a post (writes via @etzhayyim/sdk.write)
    ├── create.test.ts   # vitest — 5 cases for the reply-args parser ("all 4 fields or none" invariant)
    ├── list.ts          # CLI to list the configured DID's recent posts
    ├── verify.ts        # CLI — Merkle proof of a post against the L2 anchor
    └── index.ts         # public exports (listPosts, verifyPostUri, buildPostRecord, …)
```

## SBT gating (not in this lexicon)

Only adherents (ERC-5192 SBT holders per [ADR-2605172300](../../../90-docs/adr/2605172300-etzhayyim-bi-asset-substrate.md)) should be able to write `com.etzhayyim.apps.threads.post` records under religious-corp DIDs. That policy is enforced at the **PDS write-handler layer**, not in this lexicon — the lexicon describes only the record shape, not who's allowed to author it. Anyone can read the records once published; the substrate pipeline anchors them so the read trail is public + verifiable.

## Create

```bash
# Original post
pnpm tsx src/create.ts --text="八百万の神々に和をもって学ぶ。"

# Reply (all 4 reply-ref fields required together)
pnpm tsx src/create.ts \
  --text="amen." \
  --replyRootUri=at://did:web:.../com.etzhayyim.apps.threads.post/3kabc \
  --replyRootCid=bafy... \
  --replyParentUri=at://... \
  --replyParentCid=bafy...

# With language tags + author tags
pnpm tsx src/create.ts --text="…" --langs=ja,en --tags=sutra,study
```

Required env: `ETZ_WRITER_DID` (defaults to `did:web:etzhayyim.com`), `ETZ_PDS_URL`, and authenticated SDK session credentials (deploy-time concern; not in scope here).

## List

```bash
pnpm tsx src/list.ts --limit=20
```

Reads from the SDK client's configured DID. To list a different adherent's posts, instantiate the client with that DID.

## Verify

```bash
pnpm tsx src/verify.ts at://did:web:.../com.etzhayyim.apps.threads.post/3kabc...
```

Returns the Merkle proof (anchored MST root + path) so any third party can re-check that the post existed at the moment claimed.

## Tests

```bash
pnpm test
# 23/23 (vitest):
#   - 18 type cases: countGraphemes (ASCII / CJK / emoji ZWJ if Intl.Segmenter is available),
#                    validatePost (empty-text without reply, empty-text WITH reply, grapheme overflow,
#                    invalid + valid BCP-47, langs/tags count caps, malformed reply refs),
#                    buildPostRecord (createdAt default + preserve, empty-arrays stripped, throw on invalid, reply passthrough)
#   - 5 create cases: replyRefFromArgs ("all 4 or none" invariant, 3 partial variants)
```

## Status

| Surface | State |
|---|---|
| Record lexicon `com.etzhayyim.apps.threads.post` | ✅ |
| create / list / verify CLI + helpers | ✅ |
| Pure-helper tests | ✅ 23/23 |
| Live PDS write (first religious-social post on `pds.etzhayyim.com`) | ⏳ pending Gate 4 of [`OPERATIONAL-DEPLOY.md`](../../../50-infra/OPERATIONAL-DEPLOY.md) (PDS auth credentials) |
| Substrate pipeline propagation (mst-projector picks up → ipfs-pinner → anchor-cron) | ⏳ pending Gate 4 + 5 |
| SBT-gated write policy in PDS write-handler | ⏳ separate PR — touches `50-infra/atproto-pds-local/` |
| Embed surfaces (image / quote / link card) | ⏳ future decisions, each as a separate lexicon extension |

## See also

- [ADR-2605172000](../../../90-docs/adr/2605172000-etzhayyim-kotoba-substrate.md) — substrate rules
- [ADR-2605172300](../../../90-docs/adr/2605172300-etzhayyim-bi-asset-substrate.md) — adherent SBT model
- [`20-actors/etzhayyim-sdk/`](../../../20-actors/etzhayyim-sdk/) — substrate-purity SDK
- [`50-infra/OPERATIONAL-DEPLOY.md`](../../../50-infra/OPERATIONAL-DEPLOY.md) — production runbook
- [`60-apps/etzhayyim-project-open-isco/kotoba/`](../../etzhayyim-project-open-isco/kotoba/) etc. — taxonomy-actor pattern (different shape)
