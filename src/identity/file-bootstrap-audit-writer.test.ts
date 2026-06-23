import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileBootstrapAuditWriter } from '@/identity/file-bootstrap-audit-writer';
import type { AuditEvent } from '@/platform/audit/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('FileBootstrapAuditWriter', () => {
  it('requires an absolute directory', () => {
    expect(() => new FileBootstrapAuditWriter('relative')).toThrow('must be absolute');
  });

  it('appends sanitized audit events as durable JSON lines', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-audit-test-'));
    directories.push(directory);
    const writer = new FileBootstrapAuditWriter(directory);
    const event: AuditEvent = {
      id: 'audit-test-1',
      type: 'owner.bootstrap.attempted',
      action: 'owner.bootstrap',
      target: 'constitutional-owner',
      outcome: 'denied',
      reason: 'synthetic denial',
      occurredAt: '2026-06-22T12:00:00.000Z',
      context: createKernelRequestContext({
        requestId: 'request-test-1',
        correlationId: 'correlation-test-1',
        environment: 'test',
        actor: { id: 'audit-test', kind: 'service', authenticated: true },
        requestedAt: '2026-06-22T12:00:00.000Z',
      }),
    };

    await writer.append(event);
    await writer.append({ ...event, id: 'audit-test-2' });

    const lines = (await readFile(path.join(directory, 'owner-bootstrap-attempts.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as AuditEvent);
    expect(lines.map((item) => item.id)).toEqual(['audit-test-1', 'audit-test-2']);
  });
});
