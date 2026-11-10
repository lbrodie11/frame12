/**
 * @frame12/terminal/testing: deterministic event factories, fake streams and v1 fixtures for
 * tests, galleries and examples. Nothing here reads the clock, the environment or the disk.
 */
import { type EventOf, type EventType, type Snapshot, type TerminalEvent } from '../core/contract.js';
import type { Streams } from '../core/capabilities.js';
type Payload<T extends EventType> = Omit<EventOf<T>, 'schemaVersion' | 'type' | 'runId' | 'seq' | 'ts' | 'id'>;
export interface EventFactoryOptions {
    runId?: string;
    /** ISO 8601 start time. Default `2026-11-10T09:00:00.000Z`. */
    start?: string;
    /** Milliseconds the injected clock advances per event. Default 250. */
    stepMs?: number;
}
export interface EventFactory {
    /** Builds the next event: `seq`, `ts` and `id` come from the factory's deterministic clock. */
    next<T extends EventType>(type: T, payload: Payload<T>): EventOf<T>;
    /** Advances the injected clock without emitting an event. */
    advance(ms: number): void;
    /** The current injected time, ISO 8601. */
    now(): string;
    readonly runId: string;
}
/** A deterministic event builder with an injected clock. */
export declare function createEventFactory(options?: EventFactoryOptions): EventFactory;
export interface FakeStreamOptions {
    /** stdout and stderr are TTYs. Default false. */
    tty?: boolean;
    /** stdin is a TTY with raw mode. Defaults to `tty`. */
    stdinTty?: boolean;
    columns?: number;
    rows?: number;
}
/** Stream doubles for `detectCapabilities`. */
export declare function fakeStreams(options?: FakeStreamOptions): Required<Streams>;
export declare const FIXTURE_NAMES: readonly ["success", "failed", "canceled", "empty", "one-finding", "forty-findings", "repo-archaeology"];
export type FixtureName = (typeof FIXTURE_NAMES)[number];
export interface Fixture {
    name: FixtureName;
    description: string;
    events: TerminalEvent[];
    snapshot: Snapshot;
}
/** One named v1 fixture: its full event stream and the authoritative snapshot. Deterministic. */
export declare function fixture(name: FixtureName): Fixture;
/** Every v1 fixture. */
export declare function fixtures(): Fixture[];
/** Serializes events as NDJSON (one JSON object per line, trailing newline). */
export declare function toNdjson(events: readonly unknown[]): string;
export {};
