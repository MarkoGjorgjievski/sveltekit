# Demo Co. — SvelteKit take-home

A production-shaped slice of a marketing site and an authenticated dashboard: a prerendered
public surface (landing, blog, post pages, sitemap) and a streamed, URL-synced, optimistically
editable items table behind a signed-cookie session. Every quality gate the assignment asks for —
type checking, unit and end-to-end tests, axe, a visual baseline, bundle budgets and Lighthouse —
runs in CI rather than being described.

The requirement list is deliberately larger than the time box. This build finishes a subset to a
production bar and documents every omission with a reason; [what I cut and why](#8-what-i-cut-and-why)
is the honest part of this README.

---

## 1. Run locally

```sh
npm ci
npm run dev
```

Node is pinned by `.nvmrc` (22.23.2) and `.npmrc` sets `engine-strict=true`, so a mismatched Node
fails the install rather than producing a confusing error later.

`SESSION_SECRET` signs session cookies. Locally it falls back to a development value, so nothing
is needed to run the app. It is **required** on a real Vercel deployment: the resolver throws when
`VERCEL_ENV === 'production'` and no secret is set, rather than silently signing with a value that
is committed to this repository. Copy `.env.example` to `.env` to override it locally.

## 2. Demo credentials

Password for all three accounts: `demo1234`.

| Email              | Role   | What it shows                                                                                                                      |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `admin@demo.test`  | admin  | Full access.                                                                                                                       |
| `editor@demo.test` | editor | Can edit item status — the optimistic commit path.                                                                                 |
| `viewer@demo.test` | viewer | **The rollback path.** The status control is disabled, and the server refuses the write even if the control is re-enabled by hand. |

Archived rows refuse edits for a _different_ reason than a viewer does, with different copy —
worth trying as an editor to see the two failure classes kept apart.

## 3. Testing

```sh
npm run test:unit -- --run   # 329 tests, 51 files (node + real-Chromium component tests)
npm run test:e2e             # 21 Playwright specs: flows, axe, RUM, visual
npm run check                # svelte-check, 630 files
npm run lint                 # prettier + eslint
npm run size                 # bundle budgets
npx lhci autorun --config=./lighthouserc.cjs
sh scripts/snapshots.sh      # regenerate visual baselines (Docker; see §9)
```

`npm run test:e2e` starts its own preview server. The visual spec is skipped off Linux — see
[known gaps](#9-known-gaps).

## 4. Rendering and runtime matrix

| Route                              | Rendering               | Runtime  | Why                                                                                                 |
| ---------------------------------- | ----------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `/[[lang]]`                        | Prerendered (en + de)   | CDN      | Build-time static. Zero TTFB; LCP is a static text node.                                            |
| `/[[lang]]/blog`, `/blog/page/[n]` | Prerendered             | CDN      | 20 posts known at build. Path-based pager, so page 2 is a real URL.                                 |
| `/[[lang]]/blog/[slug]`            | Prerendered (40 pages)  | CDN      | Same.                                                                                               |
| `/[[lang]]/search`                 | SSR                     | **Edge** | Query-dependent, uncacheable, tiny payload, no Node APIs — so it runs closest to the user.          |
| `/api/rum`                         | Endpoint                | **Edge** | Highest-volume, lowest-work endpoint in the app; must never add latency to the session it measures. |
| `/og/[lang]/[slug].png`            | Prerendered (40 images) | CDN      | All inputs known at build. No runtime cost, no edge memory ceiling.                                 |
| `/[[lang]]/login`                  | SSR + form action       | **Node** | Session signing and cookie issuance on one runtime.                                                 |
| `/[[lang]]/dashboard/**`           | SSR                     | **Node** | Auth-gated, so CDN caching is impossible and cold start is irrelevant.                              |
| `/[[lang]]/dashboard/items`        | **Streamed SSR**        | **Node** | Shell and skeleton flush immediately; rows are an un-awaited promise from `load`.                   |
| `sitemap.xml`, `robots.txt`        | Prerendered             | CDN      | Locale-aware, generated at build.                                                                   |

The edge/Node split is real, not just configuration: the build emits two functions, one
`nodejs22.x` and one `edge`, and `.vercel/output/functions/api/rum.func` resolves to the edge one.

**ISR was considered and rejected, not overlooked.** With 20 build-time-known posts, prerendering
strictly dominates ISR on TTFB, cost and cache correctness. ISR becomes the right call at roughly
ten thousand posts, or when content is editor-driven and can change between deploys.

Streaming is verified rather than asserted: in a real response the skeleton appears at byte 13840
and the first row datum at 29507, inside the deferred script that opens at 29436.

## 5. Architecture decisions

**URL as the single source of query state.** One Zod-derived codec (`src/lib/url/query-codec.ts`)
is shared by the server loader and the client, so a filtered, sorted, paginated table is a
shareable link and the back button steps through what the user actually did. Typing in a search
box _replaces_ history — otherwise Back walks backwards one character at a time — while a facet
change _pushes_, because that is a state worth stepping back to. Both behaviours are pinned by
end-to-end tests.

**Sort keys are an allowlist, not a hint.** `sort` is user input that reaches a property lookup;
an unchecked value there is the one genuinely injection-shaped bug this app could have.

**Authorization is role-based and enforced on the server.** The route guard lives in `handle`, not
in a layout `load`, because layout loads do not necessarily re-run on client-side navigation. Form
actions re-check permissions independently: an action is a separate POST entry point, reachable
without ever rendering the page it sits under. Disabling a control for a viewer is a courtesy; the
server refusal is the boundary, and an e2e test re-enables the control to prove which one is
enforcing it.

**Optimistic edits are tokenised, and an override means one thing only.** Each edit mints a
strictly increasing token; commit and rollback only touch a row if their token still owns it, so
two in-flight edits on one row resolve by request order rather than by whichever response lands
last. An override means "this row has an unconfirmed edit in flight" and nothing else — an earlier
version restored a captured previous value, which during a second in-flight edit was another
edit's unconfirmed guess, and could leave a row showing a value nobody chose and the server never
accepted.

**A refresh patches the table instead of remounting it.** `invalidate` hands `{#await}` a new
promise, which re-enters its pending branch and unmounts the resolved one — throwing the skeleton
back over a table the user is working in, destroying focus inside the edited row, and discarding
the optimistic overrides with the component instance. The awaited promise is therefore swapped
only when the _query_ changes; a same-query refresh resolves into state the resolved branch
prefers.

**Streaming resolves to a `Result`, not a rejection.** The loader returns
`{ ok: true, … } | { ok: false, reason }` so a failed fetch renders an error region inside the
reserved space rather than replacing the page with an error boundary.

**Layout is reserved, not reflowed.** The streamed region reserves the skeleton's full footprint
for its whole lifetime, and the pager's height is a measured constant. Lighthouse reports
CLS 0.000 on all three audited URLs.

**State management is declared and consistent**: runes for component state, context for
cross-component state (the toast queue is context, never a module singleton, which during SSR
would leak one user's toast into another user's response), and the URL for anything shareable.

## 6. Observability

`/api/rum` accepts a discriminated-union beacon on the edge and validates before logging —
an endpoint that logs unvalidated client input is a log-injection vector, and every string is
length-bounded so a public endpoint cannot be used to write huge lines into a log bill.

Sampling is deterministic on a session id rather than random per metric. Sampling each metric
independently would mix one session's LCP with another session's INP and produce percentiles that
describe no user who ever existed. `?rum` forces inclusion so the path can be demonstrated without
waiting on a one-in-ten roll.

Client and server errors funnel into one sink shaped like Sentry's capture call, so swapping the
console for a real service is a one-file change. 404s are not reported. Identical reports are
deduped inside a two-second window, because `data-sveltekit-preload-data="hover"` runs a link's
load once on hover and again on click — a route whose load throws otherwise reports the same error
twice from a single user gesture.

Both the vitals and error modules are loaded by dynamic import, so telemetry never sits in the
bundle every visitor downloads.

## 7. What I changed in the fixtures

**Nothing was edited.** `src/lib/fixtures/` is a byte-identical copy of `mocks/`, and
`.prettierignore` excludes it so formatting cannot obscure that.

**82 i18n keys were added** in `src/lib/i18n/additions.{en,de}.json`, alongside the 41 shipped
keys, and merged at runtime. The supplied dictionary has no labels for item statuses, channels,
table columns, dashboard copy, or error messages, so a German dashboard would have rendered
English enum values straight from the data. `mocks/README.md` explicitly permits additions. A
missing German key fails the build rather than silently falling back to English.

## 8. What I cut and why

**Cut, with reasons**

1. **Service worker / offline shell.** The dashboard is auth-gated and server-authoritative; an
   offline shell would show stale rows with no reconciliation path. This is the wrong feature for
   this app, not a time cut.
2. **Image pipeline (srcset / AVIF / LQIP).** The fixtures contain no images — posts carry a
   `coverColor`, not URLs. Demonstrating a pipeline would mean inventing assets to optimise.
3. **Partial prerendering / islands.** SvelteKit has no PPR primitive; approximating it means
   hand-rolled hydration boundaries. High cost, high risk, low signal.
4. **Cross-browser E2E.** Chromium only, to keep CI under a few minutes.

**Deliberate deviations, not omissions**

5. **ISR** — considered and rejected; see the matrix above.
6. **`tailwind.config`** — does not exist in Tailwind v4. Tokens live in `@theme` in
   `src/routes/layout.css`. The assignment's wording predates v4.
7. **INP is not asserted in the lab.** Lighthouse in navigation mode cannot measure INP; it is a
   field metric requiring real interactions. `total-blocking-time` is the lab proxy and INP is
   gated by the RUM beacon instead. Asserting a lab INP number would be fabricating a measurement.
8. **`runtime: 'edge'` is deprecated** in `adapter-vercel` 6, and there is no replacement API —
   the adapter's types exclude `'edge'` from `ServerlessConfig` and require it in `EdgeConfig`,
   because Vercel is retiring the distinct edge runtime in favour of Fluid compute. The
   assignment explicitly asks for an edge route, so the deprecation is accepted knowingly.

## 9. Known gaps

- **`mocks/_generate.py` does not ship.** `mocks/README.md` documents it as the way to regenerate
  the fixtures with more rows, so "re-run it for a bigger dataset" was not possible. The 220-row
  items fixture is what the assignment provided.
- **Visual baselines are Linux-only.** Font antialiasing differs enough between Windows and Linux
  that a locally generated PNG can never match one taken on the CI runner, so the visual spec
  skips off Linux and `scripts/snapshots.sh` regenerates baselines inside the pinned Playwright
  Linux image. A baseline only one machine can satisfy is worse than a skipped test.
- **The visual baseline masks facet counts.** The authenticated suite edits statuses against the
  same in-memory store and runs first, so an unmasked shot would fail over "Draft 23" reading 22.
  What it pins is the widget's chrome, verified by a 4px padding change failing it.
- **The items store is in-memory and per-process.** Mutations do not survive a restart and are not
  shared between serverless instances. That is the right shape for a fixture-backed take-home, and
  the wrong shape for anything real.
- **E2E runs on one worker,** because those specs write to that shared store.
- **Two axe rules return "incomplete"** and are pinned as a known set: `aria-controls` on a closed
  popup, where the listbox is always rendered so the reference never dangles but axe declines to
  confirm it, and the `aria-hidden` sort arrow, which contains only non-text characters. Both were
  checked by hand. A _new_ incomplete result fails the suite, because an undecidable rule is a
  blind spot rather than a pass.
- **Headless Chromium emits no paint timings,** so the RUM e2e spec can only assert TTFB. Driven
  headed, all five vitals report and are accepted.

## 10. Measurements

| Gate                                           | Budget     | Actual                 |
| ---------------------------------------------- | ---------- | ---------------------- |
| Public initial JS                              | 50 kB gzip | 49.21 kB               |
| Dashboard initial JS                           | 74 kB gzip | 72.35 kB               |
| Lighthouse performance / a11y / best-practices | ≥ 0.95     | 1.00 on all three URLs |
| Lighthouse SEO (public pages)                  | ≥ 0.95     | 1.00                   |
| LCP                                            | ≤ 2000 ms  | ~440 ms                |
| CLS                                            | ≤ 0.1      | 0.000                  |
| TBT                                            | ≤ 200 ms   | 0 ms                   |

The assignment's stated ceilings are 80 kB and 150 kB. Nothing here comes close to them, and a
budget with 30 kB of slack does not detect a 30 kB regression — so the enforced limits sit just
above what the app actually ships.

SEO is asserted on the public surface only. The dashboard is deliberately `noindex`, which
Lighthouse scores 0.54 almost entirely for being blocked from indexing; holding an authenticated
page to ≥ 0.95 SEO would mean making it indexable to satisfy a gate.

## 11. Time spent

Around 20 hours, across five days.

A large part of that was spent verifying the gates rather than adding more of them — deliberately
breaking the code to confirm each test could actually fail. That is where most of the defects
described above were found, including two tests that passed for the wrong reason.

---

## Project layout

```
src/lib/schemas/     Zod schemas — the single source of truth for every wire shape
src/lib/server/      Repositories, auth, permissions (never imported by client code)
src/lib/url/         The query codec shared by loader and client
src/lib/ui/          Primitives and the hand-built combobox
src/lib/rum/         Sampling, transport, vitals, error reporting
src/routes/          Routes; runtime chosen per route via `export const config`
e2e/                 Playwright: flows, axe, visual, RUM
scripts/             Snapshot regeneration, Lighthouse login
```
