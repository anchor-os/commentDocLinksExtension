// @ts-check

/**
 * Priority levels for background scanning. Lower numbers run first.
 *
 *   1. active document
 *   2. visible/open documents
 *   3. referenced target documents
 *
 * Dependent documents are refreshed synchronously on change events rather
 * than queued; remaining background candidates do not exist because the
 * extension never enumerates the workspace.
 */
export const PRIORITY = Object.freeze({
    ACTIVE: 0,
    OPEN: 1,
    TARGET: 2
});

/**
 * Bounded-concurrency priority queue for document scanning.
 *
 * Goals (deliberately modest — no complicated concurrency infrastructure):
 *
 *   - Never block activation: jobs start on a later tick, never during
 *     `enqueue`.
 *   - Never read thousands of files at once: at most {@link concurrency}
 *     jobs run simultaneously.
 *   - Cooperative: the event loop breathes between jobs (`setImmediate`),
 *     so timers, input and rendering are never starved.
 *   - Duplicate work is dropped: only one pending job per key exists. A
 *     higher-priority job for the same key replaces the pending one, which
 *     is how stale queued work is cancelled without extra machinery.
 *   - Best-effort: one failing job can never break the queue. Failures are
 *     reported to an optional `onError` callback.
 *
 * Staleness of a job that is ALREADY RUNNING is the caller's concern: the
 * job re-checks the document version inside its `run` closure and aborts
 * when it no longer matches.
 */
export class ScanScheduler {

    /** @type {number} */
    #concurrency;

    /** @type {number} */
    #running = 0;

    /** @type {Map<string, { key: string, priority: number, run: () => Promise<void>|void }>} */
    #pending = new Map();

    /** @type {Array<() => void>} */
    #waiters = [];

    /** @type {boolean} */
    #pumpScheduled = false;

    /** @type {((error: unknown, key: string) => void)|undefined} */
    #onError;

    /**
     * @param {{ concurrency?: number, onError?: (error: unknown, key: string) => void }} [options]
     */
    constructor({ concurrency = 3, onError } = {}) {
        this.#concurrency = concurrency;
        this.#onError = onError;
    }

    /**
     * Queue work for a document, or replace the pending job for the same
     * key when the new priority is equal or higher.
     *
     * Jobs never start during `enqueue`: the first batch is deferred to a
     * later tick, so calling `enqueue` (for example during `activate`) can
     * never block on scanning work.
     *
     * @param {{
     *   key: string,
     *   priority: number,
     *   run: () => Promise<void>|void
     * }} job
     */
    enqueue({ key, priority, run }) {
        const existing = this.#pending.get(key);

        if (existing) {
            if (priority <= existing.priority) {
                this.#pending.set(key, { key, priority, run });
            }

            return;
        }

        this.#pending.set(key, { key, priority, run });

        this.#schedulePump();
    }

    /**
     * Defer the start of the next batch so no job runs synchronously inside
     * `enqueue`.
     */
    #schedulePump() {
        if (this.#pumpScheduled) {
            return;
        }

        this.#pumpScheduled = true;

        setImmediate(() => {
            this.#pumpScheduled = false;
            this.#pump();
        });
    }

    /**
     * Start the next batch of jobs. Keeps no more than {@link #concurrency}
     * jobs running and picks the highest-priority pending job first.
     */
    #pump() {
        while (
            this.#running < this.#concurrency &&
            this.#pending.size > 0
        ) {
            let bestKey = null;
            let bestPriority = Infinity;

            for (const [key, job] of this.#pending) {
                if (job.priority < bestPriority) {
                    bestPriority = job.priority;
                    bestKey = key;
                }
            }

            // A pending job can still lose the comparison when its priority
            // is NaN; stop rather than attempting to run `undefined`.
            if (bestKey === null) {
                break;
            }

            const job = this.#pending.get(bestKey);

            this.#pending.delete(bestKey);
            this.#running++;

            void this.#runJob(job);
        }
    }

    /**
     * @param {{ key: string, priority: number, run: () => Promise<void>|void }} job
     */
    async #runJob(job) {
        try {
            await job.run();
        } catch (error) {
            // Scanning is best-effort; one bad file never stops the queue.
            this.#onError?.(error, job.key);
        } finally {
            this.#running--;

            // Let timers, input and rendering run before the next batch.
            await new Promise((resolve) => setImmediate(resolve));

            this.#notifyIfIdle();

            if (this.#pending.size > 0) {
                this.#schedulePump();
            }
        }
    }

    /**
     * @returns {boolean} True when nothing is queued or running.
     */
    isIdle() {
        return this.#running === 0 && this.#pending.size === 0;
    }

    /**
     * Resolves when the queue has drained.
     *
     * @returns {Promise<void>}
     */
    idle() {
        if (this.isIdle()) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            this.#waiters.push(resolve);
        });
    }

    /**
     * @returns {number} Number of pending jobs.
     */
    get pendingCount() {
        return this.#pending.size;
    }

    /**
     * @returns {number} Number of running jobs.
     */
    get runningCount() {
        return this.#running;
    }

    #notifyIfIdle() {
        if (!this.isIdle()) {
            return;
        }

        const waiters = this.#waiters;

        this.#waiters = [];

        for (const resolve of waiters) {
            resolve();
        }
    }
}
