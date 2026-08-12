# External References

The model recognizes external types such as issues and APIs. A reference resolves to `external` only when it carries no file path at all (`file` is `null` or `undefined`), so there is no local target to check.

A reference that *does* supply a path but cannot be resolved inside the applicable root is not external: it resolves to `invalid-path` and stays eligible for missing-path diagnostics.

External references are not reported as missing files. Navigation displays an informational message instead.
