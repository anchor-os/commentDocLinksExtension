# Diagnostics

`DiagnosticsManager` owns the VS Code diagnostic collection.

The broken-reference scanner is conservative: it reports a reference only when it can prove the target is broken.

Broken states include missing file, missing anchor, invalid line, and invalid path. External references are not local errors.

Open documents use their in-memory text in preference to disk, so diagnostics match what the user sees.

Navigation and diagnostics must use the same resolution semantics.
