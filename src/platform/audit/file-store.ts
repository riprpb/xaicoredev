import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AuditEvent,
  KernelAuditReader,
  KernelAuditWriter,
  PersistedAuditEvent,
} from '@/platform/audit/contracts';
import { redactSensitive } from '@/platform/observability/redaction';

const GENESIS_HASH = '0'.repeat(64);
const MAX_AUDIT_LINE_BYTES = 1024 * 1024;

export class FileAuditStore implements KernelAuditWriter, KernelAuditReader {
  private readonly filePath: string;
  private appendQueue: Promise<void> = Promise.resolve();

  constructor(private readonly directory: string) {
    if (!path.isAbsolute(directory)) {
      throw new Error('Audit directory must be absolute');
    }
    this.filePath = path.join(directory, 'platform-audit.jsonl');
  }

  async append<TDetails>(event: AuditEvent<TDetails>): Promise<void> {
    const operation = this.appendQueue.then(() => this.appendInternal(event));
    this.appendQueue = operation.catch(() => undefined);
    return operation;
  }

  async get(id: string): Promise<PersistedAuditEvent | undefined> {
    return (await this.readVerified()).find((event) => event.id === id);
  }

  async listByCorrelationId(correlationId: string): Promise<readonly PersistedAuditEvent[]> {
    return (await this.readVerified()).filter(
      (event) => event.context.correlationId === correlationId
    );
  }

  async verifyIntegrity(): Promise<boolean> {
    await this.readVerified();
    return true;
  }

  private async appendInternal<TDetails>(event: AuditEvent<TDetails>): Promise<void> {
    validateAuditEvent(event);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const existing = await this.readVerified();
    const previousEventHash = existing.at(-1)?.integrityHash ?? GENESIS_HASH;
    const unsigned = {
      ...redactSensitive(event),
      constitutionalAuthority: [...(event.constitutionalAuthority ?? [])],
      previousEventHash,
    };
    const persisted: PersistedAuditEvent = {
      ...unsigned,
      integrityHash: hashAuditEvent(unsigned),
    };
    const serialized = `${JSON.stringify(persisted)}\n`;
    if (Buffer.byteLength(serialized, 'utf8') > MAX_AUDIT_LINE_BYTES) {
      throw new Error('Audit event exceeds the maximum size');
    }
    const handle = await open(this.filePath, 'a', 0o600);
    try {
      await handle.writeFile(serialized, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  private async readVerified(): Promise<PersistedAuditEvent[]> {
    let content: string;
    try {
      content = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (isMissingFile(error)) return [];
      throw error;
    }
    const events = content
      .split('\n')
      .filter(Boolean)
      .map((line) => parseAuditLine(line));
    let expectedPreviousHash = GENESIS_HASH;
    for (const event of events) {
      if (event.previousEventHash !== expectedPreviousHash) {
        throw new Error('Audit integrity chain is invalid');
      }
      const { integrityHash, ...unsigned } = event;
      const expectedHash = hashAuditEvent(unsigned);
      if (!safeHashEqual(integrityHash, expectedHash)) {
        throw new Error('Audit event integrity is invalid');
      }
      expectedPreviousHash = integrityHash;
    }
    return events;
  }
}

function validateAuditEvent(event: AuditEvent): void {
  if (
    !event.id.trim() ||
    !event.type.trim() ||
    !event.action.trim() ||
    !event.target.trim() ||
    !event.reason.trim()
  ) {
    throw new Error('Audit identity, action, target, and reason are required');
  }
  if (Number.isNaN(Date.parse(event.occurredAt))) {
    throw new Error('Audit timestamp is invalid');
  }
  if (!event.context.correlationId.trim()) {
    throw new Error('Audit correlation ID is required');
  }
}

function parseAuditLine(line: string): PersistedAuditEvent {
  if (Buffer.byteLength(line, 'utf8') > MAX_AUDIT_LINE_BYTES) {
    throw new Error('Stored audit event exceeds the maximum size');
  }
  const event = JSON.parse(line) as PersistedAuditEvent;
  if (
    typeof event.integrityHash !== 'string' ||
    typeof event.previousEventHash !== 'string' ||
    !Array.isArray(event.constitutionalAuthority)
  ) {
    throw new Error('Stored audit event is malformed');
  }
  return event;
}

function hashAuditEvent(event: object): string {
  return createHash('sha256').update(canonicalJson(event), 'utf8').digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function safeHashEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
