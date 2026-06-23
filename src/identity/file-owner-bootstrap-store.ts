import { randomUUID } from 'node:crypto';
import { access, chmod, link, mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { AuditEvent } from '@/platform/audit/contracts';
import type {
  ImmutableOwnerRecord,
  OwnerBootstrapAuditDetails,
  OwnerBootstrapStore,
} from '@/identity/owner-bootstrap';

export interface OwnerBootstrapEnvelope {
  schemaVersion: 1;
  record: ImmutableOwnerRecord;
  completionAudit: AuditEvent<OwnerBootstrapAuditDetails>;
}

export class FileOwnerBootstrapStore implements OwnerBootstrapStore {
  private readonly recordPath: string;
  private readonly reservationPath: string;

  constructor(private readonly directory: string) {
    if (!path.isAbsolute(directory)) {
      throw new Error('Owner Bootstrap storage directory must be absolute');
    }
    this.recordPath = path.join(directory, 'owner-bootstrap.record.json');
    this.reservationPath = path.join(directory, 'owner-bootstrap.reservation');
  }

  async reserve(ceremonyId: string): Promise<boolean> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    if (await exists(this.recordPath)) return false;

    try {
      const handle = await open(this.reservationPath, 'wx', 0o600);
      try {
        await handle.writeFile(JSON.stringify({ ceremonyId }), 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      return true;
    } catch (error) {
      if (isAlreadyExists(error)) return false;
      throw error;
    }
  }

  async commit(
    ceremonyId: string,
    record: ImmutableOwnerRecord,
    auditEvent: AuditEvent<OwnerBootstrapAuditDetails>
  ): Promise<void> {
    await this.requireReservation(ceremonyId);
    if (await exists(this.recordPath)) {
      throw new Error('Permanent Owner record already exists');
    }

    const temporaryPath = path.join(this.directory, `.owner-bootstrap.${randomUUID()}.tmp`);
    const envelope: OwnerBootstrapEnvelope = {
      schemaVersion: 1,
      record,
      completionAudit: auditEvent,
    };
    const handle = await open(temporaryPath, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(envelope), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }

    let committed = false;
    try {
      await link(temporaryPath, this.recordPath);
      committed = true;
    } finally {
      await Promise.allSettled([unlink(temporaryPath)]);
    }
    if (!committed) throw new Error('Permanent Owner record commit failed');

    await Promise.allSettled([chmod(this.recordPath, 0o400), unlink(this.reservationPath)]);
  }

  async abort(ceremonyId: string): Promise<void> {
    if (!(await exists(this.reservationPath))) return;
    const reservation = await this.readReservation();
    if (reservation.ceremonyId !== ceremonyId) {
      throw new Error('Owner Bootstrap reservation belongs to another ceremony');
    }
    await unlink(this.reservationPath);
  }

  async readEnvelope(): Promise<OwnerBootstrapEnvelope | undefined> {
    if (!(await exists(this.recordPath))) return undefined;
    const envelope = JSON.parse(await readFile(this.recordPath, 'utf8')) as OwnerBootstrapEnvelope;
    if (envelope.schemaVersion !== 1) {
      throw new Error('Owner Bootstrap record schema is unsupported');
    }
    return envelope;
  }

  private async requireReservation(ceremonyId: string): Promise<void> {
    if (!(await exists(this.reservationPath))) {
      throw new Error('Owner Bootstrap reservation is required');
    }
    const reservation = await this.readReservation();
    if (reservation.ceremonyId !== ceremonyId) {
      throw new Error('Owner Bootstrap reservation does not match ceremony');
    }
  }

  private async readReservation(): Promise<{ ceremonyId: string }> {
    return JSON.parse(await readFile(this.reservationPath, 'utf8')) as {
      ceremonyId: string;
    };
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isAlreadyExists(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'EEXIST'
  );
}
