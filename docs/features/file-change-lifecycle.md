# File Change Lifecycle

## Create
New targets can be indexed and affected dependents refreshed.

## Delete
Remove the deleted path from the dependency index and refresh its captured dependents.

## Rename
Capture old dependents first, remove the old entry, scan the new path, and re-scan the captured dependents.

## Edit
Scan the changed document at its current version and coalesce dependent refreshes.

## Close
Clean open-document state and source index information as required.

## Configuration change
Rebuild or invalidate state so stale diagnostics and dependency relationships do not survive a configuration reset.
