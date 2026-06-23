import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import type { AuditEvent, KernelAuditWriter } from '@/platform/audit/contracts';

export class FileBootstrapAuditWriter implements KernelAuditWriter {
  private readonly auditPath: string;

  constructor(private readonly directory: string) {
    if (!path.isAbsolute(directory)) {
      throw new Error('Owner Bootstrap audit directory must be absolute');
    }
    this.auditPath = path.join(directory, 'owner-bootstrap-attempts.jsonl');
  }

  async append<TDetails>(event: AuditEvent<TDetails>): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const handle = await open(this.auditPath, 'a', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
}
