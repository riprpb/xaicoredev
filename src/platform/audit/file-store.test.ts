import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuditEvent } from '@/platform/audit/contracts';
import { FileAuditStore } from '@/platform/audit/file-store';
import { createKernelRequestContext } from '@/platform/kernel/context';

const directories: string[] = [];
const occurredAt = '2026-06-22T16:00:00.000Z';

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function createStore(): Promise<{ directory: string; store: FileAuditStore }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-platform-audit-'));
  directories.push(directory);
  return { directory, store: new FileAuditStore(directory) };
}

function event(id: string, correlationId = 'correlation-1'): AuditEvent {
  return {
    id,
    type: 'kernel.operation.completed',
    action: 'read',
    target: 'platform.health',
    outcome: 'succeeded',
    reason: 'synthetic audit verification',
    occurredAt,
    constitutionalAuthority: ['owner'],
    permissionDecisionId: `decision-${id}`,
    context: createKernelRequestContext({
      requestId: `request-${id}`,
      correlationId,
      environment: 'test',
      actor: { id: 'owner-test', kind: 'owner', authenticated: true },
      requestedAt: occurredAt,
    }),
  };
}

describe('FileAuditStore', () => {
  it('requires an absolute storage directory', () => {
    expect(() => new FileAuditStore('relative')).toThrow('must be absolute');
  });

  it('appends concurrent events in a verifiable hash chain', async () => {
    const { store } = await createStore();
    await Promise.all([
      store.append(event('1')),
      store.append(event('2')),
      store.append(event('3')),
    ]);

    const events = await store.listByCorrelationId('correlation-1');
    expect(events).toHaveLength(3);
    expect(events[0].previousEventHash).toBe('0'.repeat(64));
    expect(events[1].previousEventHash).toBe(events[0].integrityHash);
    expect(await store.get('2')).toMatchObject({ id: '2' });
    await expect(store.verifyIntegrity()).resolves.toBe(true);
  });

  it('redacts sensitive audit details before persistence', async () => {
    const { directory, store } = await createStore();
    await store.append({
      ...event('redacted'),
      details: {
        operation: 'test',
        password: 'must-not-persist',
        nested: { recoveryToken: 'must-not-persist-either' },
      },
    });

    const content = await readFile(path.join(directory, 'platform-audit.jsonl'), 'utf8');
    expect(content).not.toContain('must-not-persist');
    expect(content).toContain('[REDACTED]');
  });

  it('detects tampering and refuses subsequent writes', async () => {
    const { directory, store } = await createStore();
    await store.append(event('tampered'));
    const filePath = path.join(directory, 'platform-audit.jsonl');
    const content = await readFile(filePath, 'utf8');
    await writeFile(filePath, content.replace('synthetic audit verification', 'modified'), 'utf8');

    await expect(store.verifyIntegrity()).rejects.toThrow('integrity');
    await expect(store.append(event('blocked'))).rejects.toThrow('integrity');
  });

  it('rejects invalid and oversized events', async () => {
    const { store } = await createStore();
    await expect(store.append({ ...event('invalid'), reason: '' })).rejects.toThrow('required');
    await expect(
      store.append({ ...event('invalid-time'), occurredAt: 'not-a-timestamp' })
    ).rejects.toThrow('timestamp');
    await expect(
      store.append({
        ...event('invalid-correlation'),
        context: { ...event('context').context, correlationId: '' },
      })
    ).rejects.toThrow('correlation');
    await expect(
      store.append({
        ...event('oversized'),
        details: { value: 'x'.repeat(1024 * 1024) },
      })
    ).rejects.toThrow('maximum size');
  });

  it('rejects malformed, oversized, and broken-link stored records', async () => {
    const malformed = await createStore();
    await writeFile(
      path.join(malformed.directory, 'platform-audit.jsonl'),
      `${JSON.stringify({ id: 'malformed' })}\n`,
      'utf8'
    );
    await expect(malformed.store.verifyIntegrity()).rejects.toThrow('malformed');

    const oversized = await createStore();
    await writeFile(
      path.join(oversized.directory, 'platform-audit.jsonl'),
      `${'x'.repeat(1024 * 1024 + 1)}\n`,
      'utf8'
    );
    await expect(oversized.store.verifyIntegrity()).rejects.toThrow('maximum size');

    const broken = await createStore();
    await broken.store.append(event('first'));
    await broken.store.append(event('second'));
    const filePath = path.join(broken.directory, 'platform-audit.jsonl');
    const lines = (await readFile(filePath, 'utf8')).trim().split('\n');
    const second = JSON.parse(lines[1]) as Record<string, unknown>;
    second.previousEventHash = 'f'.repeat(64);
    await writeFile(filePath, `${lines[0]}\n${JSON.stringify(second)}\n`, 'utf8');
    await expect(broken.store.verifyIntegrity()).rejects.toThrow('chain');
  });
});
