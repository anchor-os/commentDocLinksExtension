# Performance Tests

Record separately:

- activation latency;
- background scan duration;
- scanned document count;
- scheduler concurrency;
- filesystem workload.

The main architectural objective is to remove expensive scanning from the activation critical path, not necessarily to eliminate total work.
