import { Prisma, PrismaClient } from '@prisma/client';

export const DATABASE_TRANSACTION_OPTIONS = Object.freeze({
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 10_000,
});

export class PrismaClientLifecycle {
  private client?: PrismaClient;
  private connection?: Promise<PrismaClient>;

  constructor(private readonly createClient: () => PrismaClient = () => new PrismaClient()) {}

  getClient(): PrismaClient {
    this.client ??= this.createClient();
    return this.client;
  }

  async connect(): Promise<PrismaClient> {
    const client = this.getClient();
    this.connection ??= client
      .$connect()
      .then(() => client)
      .catch((error: unknown) => {
        this.connection = undefined;
        throw error;
      });
    return this.connection;
  }

  async transaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    const client = await this.connect();
    return client.$transaction(operation, DATABASE_TRANSACTION_OPTIONS);
  }

  async disconnect(): Promise<void> {
    const client = this.client;
    if (!client) return;
    try {
      await this.connection;
    } catch {
      // A failed connection still requires client cleanup.
    }
    await client.$disconnect();
    this.client = undefined;
    this.connection = undefined;
  }
}
