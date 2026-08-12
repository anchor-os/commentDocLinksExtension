# Diagnostics Feature

```text
document -> scanner -> references -> resolver -> broken statuses -> VS Code diagnostics
```

Diagnostics are placed over the reference range. They refresh for changed documents and affected dependents discovered through the reverse dependency index.
