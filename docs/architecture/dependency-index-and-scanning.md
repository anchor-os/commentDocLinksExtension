# Dependency Index and Background Scanning

The dependency graph conceptually maintains:

```text
source -> targets
target -> sources
```

The reverse mapping lets a changed target refresh only its dependents.

## Scanner

A scan:
1. Checks document/version freshness.
2. Indexes references.
3. Updates diagnostics for open documents.
4. Queues referenced targets.

Disk-only targets can be scanned asynchronously.

## Scheduler

Jobs have priorities for active documents, other open documents, and referenced targets. Jobs are keyed by filesystem path so repeated requests can be coalesced.

## Rename invariant

Always do:

```text
capture dependents(old)
remove(old)
queue(new)
re-scan captured dependents
```

Never remove the old entry before capturing its dependents.

## Debounced refresh

Rapid changes to a target can coalesce dependent diagnostic refreshes, reducing repeated work while typing.
