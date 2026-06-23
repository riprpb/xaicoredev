import type { KernelRequestContext } from '@/platform/kernel/context';
import { redactSensitive } from '@/platform/observability/redaction';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogRecord {
  level: LogLevel;
  event: string;
  timestamp: string;
  correlationId?: string;
  requestId?: string;
  data?: unknown;
}

export interface StructuredLogSink {
  write(record: StructuredLogRecord): void;
}

export class StructuredLogger {
  constructor(
    private readonly sink: StructuredLogSink,
    private readonly now: () => Date = () => new Date()
  ) {}

  log(level: LogLevel, event: string, context?: KernelRequestContext, data?: unknown): void {
    if (!event.trim()) throw new Error('Structured log event name is required');
    this.sink.write({
      level,
      event,
      timestamp: this.now().toISOString(),
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      data: data === undefined ? undefined : redactSensitive(data),
    });
  }
}

export class ConsoleJsonLogSink implements StructuredLogSink {
  write(record: StructuredLogRecord): void {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  }
}
