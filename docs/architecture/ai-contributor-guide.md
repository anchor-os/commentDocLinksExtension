# AI Contributor Guide

Before changing code:

1. Read the architecture overview.
2. Identify the owning layer: parser, resolver, filesystem, scanner, scheduler, or presentation.
3. Read the relevant feature document.
4. Read the related tests.

Prefer shared types, resolver/context, workspace/path utilities, dependency indexing, scheduler APIs, and dependency injection.

Avoid ad-hoc path joins, duplicate parsing, UI-owned dependency-index mutation, synchronous disk I/O in background scanning, or tests that merely duplicate implementation logic.

Critical invariants:
- references stay inside the applicable root;
- worktrees resolve against the correct checkout;
- unsaved text wins over disk;
- dependency mappings survive create/delete/rename/edit;
- queued work is deduplicated per path and every job re-checks the recorded scan version before indexing (note: jobs are not serialized per path, so a job that is already running is not cancelled by a newer one — scan results are last-write-wins);
- external references are not local missing-file errors.
