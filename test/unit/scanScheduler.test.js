// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    ScanScheduler,
    PRIORITY
} from "../../src/scanning/scanScheduler.js";

const tick = () =>
    new Promise((resolve) => setImmediate(resolve));

test("enqueue runs jobs on a later tick, never synchronously", async () => {
    const scheduler = new ScanScheduler();
    let ran = false;

    scheduler.enqueue({
        key: "a",
        priority: PRIORITY.ACTIVE,
        run: () => {
            ran = true;
        }
    });

    assert.equal(ran, false, "job must not run during enqueue");

    await tick();

    assert.equal(ran, true);
    assert.equal(scheduler.isIdle(), true);
});

test("higher priority jobs run before lower priority jobs", async () => {
    const scheduler = new ScanScheduler({ concurrency: 1 });
    const order = [];
    let release;

    const gate = new Promise((resolve) => {
        release = resolve;
    });

    scheduler.enqueue({
        key: "gate",
        priority: PRIORITY.OPEN,
        run: async () => {
            order.push("gate");
            await gate;
        }
    });

    // Let the deferred pump start the gate so it holds the single running
    // slot while the remaining jobs are queued below.
    await tick();

    scheduler.enqueue({
        key: "target",
        priority: PRIORITY.TARGET,
        run: () => order.push("target")
    });
    scheduler.enqueue({
        key: "open-2",
        priority: PRIORITY.OPEN,
        run: () => order.push("open-2")
    });
    scheduler.enqueue({
        key: "active",
        priority: PRIORITY.ACTIVE,
        run: () => order.push("active")
    });
    scheduler.enqueue({
        key: "open-1",
        priority: PRIORITY.OPEN,
        run: () => order.push("open-1")
    });

    release();

    await scheduler.idle();

    // Pending work drains in priority order once the gate opens; jobs with
    // equal priority run in enqueue order.
    assert.deepEqual(order, [
        "gate",
        "active",
        "open-2",
        "open-1",
        "target"
    ]);
});

test("bounded concurrency never exceeds the limit", async () => {
    const scheduler = new ScanScheduler({ concurrency: 2 });
    let running = 0;
    let peak = 0;

    const jobs = Array.from({ length: 10 }, (_, i) => {
        scheduler.enqueue({
            key: `job-${i}`,
            priority: PRIORITY.OPEN,
            run: async () => {
                running++;
                peak = Math.max(peak, running);

                await tick();

                running--;
            }
        });
    });

    await scheduler.idle();

    assert.equal(peak, 2);
    assert.equal(running, 0);
});

test("one pending job per key: a same/higher priority enqueue replaces it", async () => {
    const scheduler = new ScanScheduler({ concurrency: 1 });
    const order = [];
    let release;

    const gate = new Promise((resolve) => {
        release = resolve;
    });

    scheduler.enqueue({
        key: "gate",
        priority: PRIORITY.OPEN,
        run: async () => {
            order.push("gate");
            await gate;
        }
    });

    // Let the deferred pump start the gate so it holds the single running
    // slot while the "doc" jobs are queued below.
    await tick();

    scheduler.enqueue({
        key: "doc",
        priority: PRIORITY.OPEN,
        run: () => order.push("first")
    });

    scheduler.enqueue({
        key: "doc",
        priority: PRIORITY.OPEN,
        run: () => order.push("second")
    });

    scheduler.enqueue({
        key: "doc",
        priority: PRIORITY.ACTIVE,
        run: () => order.push("third")
    });

    // Only the highest-priority pending job for "doc" survives.
    assert.equal(scheduler.pendingCount, 1);

    release();

    await scheduler.idle();

    assert.deepEqual(order, ["gate", "third"]);
});

test("a lower priority enqueue for a pending key is ignored", async () => {
    const scheduler = new ScanScheduler({ concurrency: 1 });
    const order = [];
    let release;

    const gate = new Promise((resolve) => {
        release = resolve;
    });

    scheduler.enqueue({
        key: "gate",
        priority: PRIORITY.OPEN,
        run: async () => {
            order.push("gate");
            await gate;
        }
    });

    // Let the deferred pump start the gate so it holds the single running
    // slot while the "doc" jobs are queued below.
    await tick();

    scheduler.enqueue({
        key: "doc",
        priority: PRIORITY.ACTIVE,
        run: () => order.push("active")
    });

    scheduler.enqueue({
        key: "doc",
        priority: PRIORITY.TARGET,
        run: () => order.push("target")
    });

    assert.equal(scheduler.pendingCount, 1);

    release();

    await scheduler.idle();

    assert.deepEqual(order, ["gate", "active"]);
});

test("idle resolves when the queue is drained", async () => {
    const scheduler = new ScanScheduler({ concurrency: 2 });
    let idleResolved = false;

    for (let i = 0; i < 6; i++) {
        scheduler.enqueue({
            key: `job-${i}`,
            priority: PRIORITY.OPEN,
            run: async () => {
                await tick();
            }
        });
    }

    const idle = scheduler.idle().then(() => {
        idleResolved = true;
    });

    await idle;

    assert.equal(idleResolved, true);
    assert.equal(scheduler.isIdle(), true);
});

test("a failing job never breaks the queue", async () => {
    const scheduler = new ScanScheduler({ concurrency: 1 });
    const order = [];

    scheduler.enqueue({
        key: "bad",
        priority: PRIORITY.ACTIVE,
        run: async () => {
            throw new Error("boom");
        }
    });

    scheduler.enqueue({
        key: "good",
        priority: PRIORITY.OPEN,
        run: () => order.push("good")
    });

    await scheduler.idle();

    assert.deepEqual(order, ["good"]);
});

test("jobs enqueued while running are processed after the current batch", async () => {
    const scheduler = new ScanScheduler({ concurrency: 1 });
    const order = [];
    let targetEnqueued = false;

    scheduler.enqueue({
        key: "source",
        priority: PRIORITY.ACTIVE,
        run: async () => {
            order.push("source");

            if (!targetEnqueued) {
                targetEnqueued = true;

                scheduler.enqueue({
                    key: "target",
                    priority: PRIORITY.TARGET,
                    run: () => order.push("target")
                });
            }
        }
    });

    scheduler.enqueue({
        key: "open",
        priority: PRIORITY.OPEN,
        run: () => order.push("open")
    });

    await scheduler.idle();

    // The target enqueued mid-run still runs; the pending open job ran
    // before it because OPEN outranks TARGET.
    assert.deepEqual(order, ["source", "open", "target"]);
});

test("pendingCount and runningCount report queue state", async () => {
    const scheduler = new ScanScheduler({ concurrency: 1 });

    scheduler.enqueue({
        key: "a",
        priority: PRIORITY.OPEN,
        run: async () => {
            await tick();
        }
    });
    scheduler.enqueue({
        key: "b",
        priority: PRIORITY.OPEN,
        run: async () => {
            await tick();
        }
    });
    scheduler.enqueue({
        key: "c",
        priority: PRIORITY.OPEN,
        run: async () => {
            await tick();
        }
    });

    // The first batch has not started yet (deferred), so everything is
    // pending.
    assert.equal(scheduler.runningCount, 0);
    assert.equal(scheduler.pendingCount, 3);

    await tick();

    assert.equal(scheduler.runningCount, 1);
    assert.equal(scheduler.pendingCount, 2);

    await scheduler.idle();

    assert.equal(scheduler.runningCount, 0);
    assert.equal(scheduler.pendingCount, 0);
});

test("a second job for a running key waits instead of racing it", async () => {
    const scheduler = new ScanScheduler({ concurrency: 3 });
    const events = [];
    let release;

    const gate = new Promise((resolve) => {
        release = resolve;
    });

    scheduler.enqueue({
        key: "a",
        priority: PRIORITY.OPEN,
        run: async () => {
            events.push("first:start");
            await gate;
            events.push("first:end");
        }
    });

    // Let the deferred pump start the first job so it occupies the key.
    await tick();

    assert.deepEqual(events, ["first:start"]);

    scheduler.enqueue({
        key: "a",
        priority: PRIORITY.ACTIVE,
        run: () => {
            events.push("second:start");
        }
    });

    // Several pumps must not be enough to start the second job: the key is
    // busy, and a concurrent run could write its result out of order.
    await tick();
    await tick();

    assert.deepEqual(
        events,
        ["first:start"],
        "the second job for the same key must not start yet"
    );
    assert.equal(scheduler.runningCount, 1);
    assert.equal(scheduler.pendingCount, 1);

    release();

    await scheduler.idle();

    assert.deepEqual(
        events,
        ["first:start", "first:end", "second:start"],
        "the queued job must run only after the running one completes"
    );
});

test("a busy key does not block jobs for other keys", async () => {
    const scheduler = new ScanScheduler({ concurrency: 3 });
    const started = [];
    let release;

    const gate = new Promise((resolve) => {
        release = resolve;
    });

    scheduler.enqueue({
        key: "busy",
        priority: PRIORITY.OPEN,
        run: async () => {
            started.push("busy");
            await gate;
        }
    });

    await tick();

    // A repeat of the busy key must wait, but an unrelated key must still
    // use the free concurrency slot.
    scheduler.enqueue({
        key: "busy",
        priority: PRIORITY.OPEN,
        run: () => started.push("busy-again")
    });
    scheduler.enqueue({
        key: "other",
        priority: PRIORITY.OPEN,
        run: () => started.push("other")
    });

    await tick();
    await tick();

    assert.deepEqual(started, ["busy", "other"]);

    release();

    await scheduler.idle();

    assert.deepEqual(started, ["busy", "other", "busy-again"]);
});
