import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DATABASE_TRANSACTION_OPTIONS, PrismaClientLifecycle } from '@/database/client';

function createFakeClient() {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn(async (operation: (transaction: object) => Promise<unknown>) =>
      operation({ transaction: true })
    ),
  };
}

describe('PrismaClientLifecycle', () => {
  it('connects once, runs serializable transactions, and disconnects cleanly', async () => {
    const fake = createFakeClient();
    const lifecycle = new PrismaClientLifecycle(() => fake as unknown as PrismaClient);

    const [first, second] = await Promise.all([lifecycle.connect(), lifecycle.connect()]);
    expect(first).toBe(second);
    expect(fake.$connect).toHaveBeenCalledOnce();

    await expect(lifecycle.transaction(async (transaction) => Boolean(transaction))).resolves.toBe(
      true
    );
    expect(fake.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      DATABASE_TRANSACTION_OPTIONS
    );
    expect(DATABASE_TRANSACTION_OPTIONS.isolationLevel).toBe(
      Prisma.TransactionIsolationLevel.Serializable
    );

    await lifecycle.disconnect();
    expect(fake.$disconnect).toHaveBeenCalledOnce();
  });

  it('does not instantiate a client merely to disconnect', async () => {
    const factory = vi.fn();
    const lifecycle = new PrismaClientLifecycle(factory);
    await lifecycle.disconnect();
    expect(factory).not.toHaveBeenCalled();
  });

  it('creates the production Prisma client lazily', async () => {
    const lifecycle = new PrismaClientLifecycle();
    expect(lifecycle.getClient()).toBeInstanceOf(PrismaClient);
    await lifecycle.disconnect();
  });

  it('resets a failed connection so a later attempt can retry', async () => {
    const fake = createFakeClient();
    fake.$connect.mockRejectedValueOnce(new Error('database unavailable'));
    const lifecycle = new PrismaClientLifecycle(() => fake as unknown as PrismaClient);

    await expect(lifecycle.connect()).rejects.toThrow('database unavailable');
    await expect(lifecycle.connect()).resolves.toBe(fake);
    expect(fake.$connect).toHaveBeenCalledTimes(2);
    await lifecycle.disconnect();
  });

  it('cleans up a client after connection failure', async () => {
    const fake = createFakeClient();
    fake.$connect.mockRejectedValueOnce(new Error('database unavailable'));
    const lifecycle = new PrismaClientLifecycle(() => fake as unknown as PrismaClient);

    await expect(lifecycle.connect()).rejects.toThrow('database unavailable');
    await lifecycle.disconnect();
    expect(fake.$disconnect).toHaveBeenCalledOnce();
  });
});
