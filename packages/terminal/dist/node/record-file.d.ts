import type { RecordSink } from '../core/recording.js';
export interface FileRecordSink extends RecordSink {
    /** Drop the recording: the target path is left as it was. */
    discard(): void;
}
export declare function fileRecordSink(path: string): FileRecordSink;
