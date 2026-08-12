# Performance Notes

Measurements for the startup / lazy background scanning work.

## Method

The workload is reproduced against the real production modules
(`scanDocumentForReferences`, `targetsReferencedBy`,
`collectBrokenReferences`) in a plain Node harness —
`test/performance/measure.js`. It mirrors the exact work `extension.js`
performs today for each open document during activation (index targets +
collect broken references, with real synchronous filesystem reads), plus the
scan-only parser path shared by the link/hover/decoration providers.

Synthetic workspaces (see `test/performance/workspace.js`):
source `src/mod-*.js` files each carry five anchor references to a
`documentation/doc-*.md` file, so validation performs real reads and parses.

- small: 10 source + 10 documentation files (20 files)
- medium: 100 + 100 (200 files)
- large: 1000 + 1000 (2000 files)

Each number is the median of 5 iterations (baseline) or 3 iterations
(after). `heap+MB` is the median change in
`process.memoryUsage().heapUsed`; `rssMB` is the process RSS sampled after
the activation workload. Timings are for the extension's own scanning work —
VS Code host overhead is not included.

## Baseline (before the lazy scanning changes)

Recorded with `node test/performance/measure.js baseline`.

| size   | files | activation | firstDoc | scanMs  | heap+MB | rssMB  |
|--------|-------|-----------:|---------:|--------:|--------:|-------:|
| small  |    20 |    12.24ms |    0.90ms |   0.35ms | -0.31MB | 56.53MB |
| medium |   200 |   102.78ms |    0.86ms |   3.86ms |  0.41MB | 58.98MB |
| large  |  2000 |  1795.93ms |    0.85ms | 144.65ms | -1.27MB | 64.64MB |

Notes:

- Activation scans every open document **synchronously** during
  `activate()` (`updateAllDiagnostics` at the end of `extension.js`).
  With 2000 open files this blocks startup for ~1.8 s.
- The active document itself is cheap (~0.8 ms), so the fix is to make the
  per-document work lazy and prioritized rather than faster per file.
- There is no whole-repository scan today; the cost scales with the number
  of **open** documents.

## Comparison

Generated from `test/performance/measure.js`.

| Metric | Size | Before | After | Change |
|---|---|---|---|---|
| Startup block (all open docs) | small | 10.98 ms | 3.13 ms | 29% |
| Startup block (all open docs) | medium | 94.16 ms | 2.80 ms | 3% |
| Startup block (all open docs) | large | 1998.98 ms | 4.67 ms | 0% |
| First document ready | small | 0.88 ms | 0.88 ms | 100% |
| First document ready | medium | 0.84 ms | 0.78 ms | 93% |
| First document ready | large | 0.76 ms | 0.85 ms | 112% |
| Total background scan | small | 10.98 ms | 11.63 ms | 106% |
| Total background scan | medium | 94.16 ms | 122.85 ms | 130% |
| Total background scan | large | 1998.98 ms | 2268.18 ms | 113% |
| Timer delay during scan (20 ms nominal) | small | 22.02 ms | 20.43 ms | 93% |
| Timer delay during scan (20 ms nominal) | medium | 92.40 ms | 23.65 ms | 26% |
| Timer delay during scan (20 ms nominal) | large | 1773.46 ms | 21.32 ms | 1% |
| Duplicate re-scan (same version) | small | — | 0.01 ms | — |
| Duplicate re-scan (same version) | medium | — | 0.03 ms | — |
| Duplicate re-scan (same version) | large | — | 0.12 ms | — |


## Raw results

- baseline: small, files=20, activation=10.98ms, sync=—ms, firstDoc=0.88ms, scan=0.36ms, drain=—ms, rescan=—ms, respDelay=22.020792ms, rss=57.77MB
- baseline: medium, files=200, activation=94.16ms, sync=—ms, firstDoc=0.84ms, scan=3.5ms, drain=—ms, rescan=—ms, respDelay=92.40025ms, rss=59.91MB
- baseline: large, files=2000, activation=1998.98ms, sync=—ms, firstDoc=0.76ms, scan=180.32ms, drain=—ms, rescan=—ms, respDelay=1773.45975ms, rss=65.59MB
- after: small, files=20, activation=3.13ms, sync=0ms, firstDoc=0.88ms, scan=0.45ms, drain=11.63ms, rescan=0.01ms, respDelay=20.43375ms, rss=58.23MB
- after: medium, files=200, activation=2.8ms, sync=0ms, firstDoc=0.78ms, scan=3.78ms, drain=122.85ms, rescan=0.03ms, respDelay=23.6545ms, rss=61.45MB
- after: large, files=2000, activation=4.67ms, sync=0ms, firstDoc=0.85ms, scan=170.11ms, drain=2268.18ms, rescan=0.12ms, respDelay=21.3195ms, rss=79.67MB
