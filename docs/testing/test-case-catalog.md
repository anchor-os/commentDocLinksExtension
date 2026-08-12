# Test Case Catalog

| ID | Area | Scenario | Expected |
|---|---|---|---|
| TC-001 | Reference | Valid documentation reference | Valid |
| TC-002 | Reference | Missing target | `missing-file` |
| TC-003 | Reference | Missing anchor | `missing-anchor` |
| TC-004 | Reference | Invalid line | `invalid-line` |
| TC-005 | Security | `../` escape | `invalid-path` |
| TC-006 | Security | Symlink escape | `invalid-path` |
| TC-007 | Worktree | Linked worktree | Correct root |
| TC-008 | Diagnostics | Broken reference | Warning |
| TC-009 | Diagnostics | Fix reference | Warning clears |
| TC-010 | Dependency | Target edit | Dependents refresh |
| TC-011 | Dependency | Multiple dependents | All refresh |
| TC-012 | Dependency | Delete target | Index cleaned |
| TC-013 | Dependency | Rename target | Old dependents re-index |
| TC-014 | Dependency | Rename source | New source indexed |
| TC-015 | Completion | Comment anchor | Suggestions |
| TC-016 | Completion | Markdown source | Suggestions |
| TC-017 | Completion | Invalid context | None |
| TC-018 | Config | Diagnostics disabled | No diagnostics |
| TC-019 | Config | Completion disabled | No completion |
| TC-020 | Lifecycle | Close document | State cleaned |
| TC-021 | Scheduler | Concurrency bound | Never exceeded |
| TC-022 | Scheduler | Duplicate key | Coalesced |
| TC-023 | Scheduler | Job failure | Others continue |
| TC-024 | Performance | Activation | Scan deferred |
| TC-025 | E2E | Real rename | Dependency graph follows |
