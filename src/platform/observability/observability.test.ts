import { describe, expect, it, vi } from 'vitest';
import { createKernelRequestContext } from '@/platform/kernel/context';
import { PlatformHealthService } from '@/platform/observability/health';
import {
  ConsoleJsonLogSink,
  StructuredLogger,
  type StructuredLogRecord,
} from '@/platform/observability/logging';
import { MetricsRegistry } from '@/platform/observability/metrics';
import { redactSensitive } from '@/platform/observability/redaction';

const now = new Date('2026-06-22T16:00:00.000Z');

describe('Platform observability', () => {
  it('aggregates required and optional dependency health without exposing failures', async () => {
    const healthy = new PlatformHealthService(
      'xaicore-api',
      '1.0.0',
      [{ id: 'config', required: true, check: async () => 'healthy' }],
      () => now
    );
    const degraded = new PlatformHealthService(
      'xaicore-api',
      '1.0.0',
      [{ id: 'optional', required: false, check: async () => 'unhealthy' }],
      () => now
    );
    const unhealthy = new PlatformHealthService(
      'xaicore-api',
      '1.0.0',
      [
        {
          id: 'database',
          required: true,
          check: async () => {
            throw new Error('private connection failure');
          },
        },
      ],
      () => now
    );

    await expect(healthy.checkReadiness()).resolves.toMatchObject({ status: 'healthy' });
    await expect(degraded.checkHealth()).resolves.toMatchObject({ status: 'degraded' });
    const failed = await unhealthy.checkReadiness();
    expect(failed).toMatchObject({
      status: 'unhealthy',
      dependencies: [{ message: 'dependency check failed' }],
    });
    expect(JSON.stringify(failed)).not.toContain('private connection failure');
    await expect(unhealthy.checkLiveness()).resolves.toMatchObject({
      status: 'healthy',
      dependencies: [],
    });
  });

  it('redacts nested, binary, and circular sensitive values', () => {
    const value: Record<string, unknown> = {
      operation: 'inspect',
      password: 'secret-password',
      nested: { authorization: 'Bearer secret-token' },
      bytes: Buffer.from('binary-secret'),
    };
    value.circular = value;

    const redacted = redactSensitive(value);
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain('secret-password');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('binary-secret');
    expect(serialized).toContain('[REDACTED_CIRCULAR]');
  });

  it('emits stable structured logs with correlation and redacted data', () => {
    const records: StructuredLogRecord[] = [];
    const logger = new StructuredLogger({ write: (record) => records.push(record) }, () => now);
    const context = createKernelRequestContext({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      environment: 'test',
      actor: { id: 'service-1', kind: 'service', authenticated: true },
      requestedAt: now.toISOString(),
    });

    logger.log('info', 'platform.health.checked', context, {
      status: 'healthy',
      accessToken: 'not-for-logs',
    });

    expect(records[0]).toMatchObject({
      event: 'platform.health.checked',
      correlationId: 'correlation-1',
      requestId: 'request-1',
      timestamp: now.toISOString(),
      data: { status: 'healthy', accessToken: '[REDACTED]' },
    });
    expect(() => logger.log('info', ' ')).toThrow('event name');
  });

  it('tracks deterministic counters and gauges and validates metric input', () => {
    const metrics = new MetricsRegistry();
    metrics.increment('kernel.operations');
    metrics.increment('kernel.operations', 2);
    metrics.setGauge('platform.dependencies', 3);

    expect(metrics.snapshot()).toEqual({
      counters: { 'kernel.operations': 3 },
      gauges: { 'platform.dependencies': 3 },
    });
    expect(() => metrics.increment('Invalid Metric')).toThrow('name');
    expect(() => metrics.setGauge('platform.invalid', Number.NaN)).toThrow('finite');
  });

  it('writes console logs as one JSON line', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    new ConsoleJsonLogSink().write({
      level: 'info',
      event: 'test.event',
      timestamp: now.toISOString(),
    });

    expect(write).toHaveBeenCalledWith(expect.stringMatching(/"event":"test.event".*\n$/));
    write.mockRestore();
  });

  it('requires health identity metadata', () => {
    expect(() => new PlatformHealthService('', '1.0.0', [])).toThrow('required');
  });
});
