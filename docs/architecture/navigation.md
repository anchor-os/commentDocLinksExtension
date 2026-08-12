# Navigation

Navigation uses the shared resolver:

```text
parse -> context -> validate -> open target -> reveal anchor/line
```

External references have no local target and produce an informational message. Missing files and invalid paths produce errors.

Navigation must not implement a separate path-resolution model.
