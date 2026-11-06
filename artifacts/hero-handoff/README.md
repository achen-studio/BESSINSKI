# Hero photo handoff verification

## Demonstrated cause

Chrome reproduced a brightness dip during initial loading: setting data-renderer=webgl immediately hid the HTML cover, while the canvas opacity transitioned from 0 to 1 over 200 ms. A valid WebGL draw already existed. The background therefore showed through the cover for 12 sampled animation frames, on desktop and mobile-sized viewports, with cold/warm cache and throttled networking.

This establishes the initial-load defect, not the exact cause of the previously supplied navigation video. The click-time flicker was not reproduced. Cover navigation to /son was tested separately and retained the same image URL.

## Minimal fix

- app/bess.css: remove the canvas opacity transition so the HTML/canvas visibility handoff is atomic.
- app/hero-scene.ts: decode textures, require positive layout dimensions and a successful first render before announcing WebGL readiness; preserve the static fallback on errors, hidden initial documents and context loss. Existing disposal remains in place.
- scripts/verify-hero-handoff.cjs: browser instrumentation and regression checks, outside production code.

No changes to title animation, shaders, framing or navigation logic. The pre-existing Le Ciel title sizing/spacing changes in bess.css were preserved and are not part of this fix. No deployment performed.

## Evidence

- [Before screenshot](before.png), [after screenshot](after.png).
- [Before trace](before.json), [after trace](after.json).
- [Baseline matrix](before-summary.json), [Chrome matrix](chrome-summary.json), [WebKit matrix](webkit-summary.json).

Baseline desktop timeline: first draw around 269 ms, HTML opacity 0 and canvas opacity 0 around 279 ms, canvas fully opaque around 470 ms. After: texture upload around 346 ms, first valid draw around 363 ms; HTML 1 / canvas 0 at 364 ms, HTML 0 / canvas 1 at 373 ms. No intermediate opacity dip in the after trace. Times are relative to each run, not performance comparisons.

## Executed tests

- Chrome: 390x900 and 1440x900, normal cold/warm cache, slow network, WebGL disabled; initial load, cover click to /son, and back navigation. All eight after cases have zero opacity dips and zero premature switches, and preserve the destination asset.
- Playwright WebKit: same eight cases passed. Its slow mode adds 150 ms request latency only; Chrome additionally uses bandwidth throttling.
- Final Chrome normal/no-WebGL regression: six cases passed, including valid first-frame alpha and visible static fallback checks. A further four normal navigation cases passed after adding navigation trace persistence.
- Chrome fault checks: context loss/restoration, texture request failure, and initially hidden document all retained the static fallback until a valid render was possible.
- npm test: 12 tests passed, including successful Netlify build.
- ESLint app/hero-scene.ts and git diff --check passed.

## Reproduction

Run the local preview on port 4174, then use Node with Playwright installed:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/playwright node scripts/verify-hero-handoff.cjs
ENGINE=webkit PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/playwright node scripts/verify-hero-handoff.cjs
```

Optional environment variables: BASE_URL, OUT, MODES (normal,slow,no-webgl). EXPECT_BASELINE permits known baseline failures when testing the old code. The Chromium runner uses the local macOS Google Chrome application.

## Limits

Playwright WebKit is not the Safari application. Real Safari, physical iPhone/GPU behavior, and the other three song destination routes were not tested in this matrix. Screenshot and opacity/first-pixel instrumentation support the demonstrated handoff defect; they do not establish that every possible compositor/navigation flicker is absent. The reported click-time flicker remains unconfirmed.
