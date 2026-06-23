import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import type { ServerConfig } from '@/config/environment';
import type { ComponentHealth, HealthContract } from '@/platform/contracts/health';
import type { StructuredLogRecord } from '@/platform/observability/logging';
import { MetricsRegistry } from '@/platform/observability/metrics';
import { createApp } from '@/server/app';

const servers: Server[] = [];
const config: ServerConfig = {
  environment: 'test',
  host: '127.0.0.1',
  port: 3000,
  allowedOrigins: ['http://localhost:5173'],
  apiRateLimit: 100,
  apiRateWindowMs: 60_000,
};

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
          )
      )
  );
});

async function startServer(
  observability: Parameters<typeof createApp>[1] = {},
  overrides: Partial<ServerConfig> = {}
): Promise<string> {
  const server = createApp({ ...config, ...overrides }, observability).listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe('active API observability', () => {
  it('serves health, readiness, liveness, version, dependency, and metrics evidence', async () => {
    const metrics = new MetricsRegistry();
    const baseUrl = await startServer({ metrics });

    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
    const readiness = await fetch(`${baseUrl}/api/health/ready`).then((response) =>
      response.json()
    );
    const liveness = await fetch(`${baseUrl}/api/health/live`).then((response) => response.json());
    const version = await fetch(`${baseUrl}/api/version`).then((response) => response.json());
    const metricResponse = await fetch(`${baseUrl}/api/metrics`).then((response) =>
      response.json()
    );

    expect(health.data).toMatchObject({
      componentId: 'xaicore-api',
      status: 'healthy',
      dependencies: [{ id: 'runtime-config', status: 'healthy' }],
    });
    expect(readiness.data.status).toBe('healthy');
    expect(liveness.data.status).toBe('healthy');
    expect(version.data).toEqual({ version: '1.0.0', environment: 'test' });
    expect(metricResponse.data.counters).toMatchObject({
      'http.health.requests': 1,
      'http.readiness.requests': 1,
      'http.liveness.requests': 1,
      'http.version.requests': 1,
      'http.metrics.requests': 1,
    });
  });

  it('returns 503 when required readiness dependencies are unhealthy', async () => {
    const unhealthy: HealthContract = {
      checkHealth: async () => component('unhealthy'),
      checkReadiness: async () => component('unhealthy'),
      checkLiveness: async () => component('healthy'),
    };
    const baseUrl = await startServer({ health: unhealthy });

    const response = await fetch(`${baseUrl}/api/health/ready`);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ success: false });
  });

  it('logs stable error metadata and returns a generic response', async () => {
    const records: StructuredLogRecord[] = [];
    const baseUrl = await startServer({ logSink: { write: (record) => records.push(record) } });

    const response = await fetch(`${baseUrl}/api`, {
      headers: { origin: 'https://not-approved.example' },
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      event: 'http.request.failed',
      data: { errorType: 'Error' },
    });
    expect(JSON.stringify(records)).not.toContain('not-approved.example');
  });

  it('routes health probe failures through the generic error boundary', async () => {
    const records: StructuredLogRecord[] = [];
    const failedHealth: HealthContract = {
      checkHealth: async () => Promise.reject(new Error('private health failure')),
      checkReadiness: async () => Promise.reject(new Error('private readiness failure')),
      checkLiveness: async () => Promise.reject(new Error('private liveness failure')),
    };
    const baseUrl = await startServer({
      health: failedHealth,
      logSink: { write: (record) => records.push(record) },
    });

    for (const endpoint of ['/api/health', '/api/health/ready', '/api/health/live']) {
      const response = await fetch(`${baseUrl}${endpoint}`);
      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain('private');
    }
    expect(records).toHaveLength(3);
  });

  it('rate-limits API requests without exposing private request details', async () => {
    const baseUrl = await startServer({}, { apiRateLimit: 1, apiRateWindowMs: 60_000 });

    expect((await fetch(`${baseUrl}/api`)).status).toBe(200);
    const limited = await fetch(`${baseUrl}/api`);
    const body = await limited.text();

    expect(limited.status).toBe(429);
    expect(body).not.toContain('127.0.0.1');
    expect(body).not.toContain('localhost');
  });
});

function component(status: 'healthy' | 'unhealthy'): ComponentHealth {
  return {
    componentId: 'xaicore-api',
    status,
    version: '1.0.0',
    checkedAt: '2026-06-22T16:00:00.000Z',
    dependencies: [],
  };
}
