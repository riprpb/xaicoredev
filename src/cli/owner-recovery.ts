import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import readline from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { readSecretFromTerminal } from '@/cli/owner-bootstrap';
import type { OwnerCredentialRecord } from '@/identity/owner-credential-workflow';
import { verifyOwnerTotpFactor } from '@/identity/owner-mfa-workflow';
import { FileOwnerRecoveryWorkflow } from '@/identity/owner-recovery-workflow';
import { FileAuditStore } from '@/platform/audit/file-store';
import { createKernelRequestContext } from '@/platform/kernel/context';

export interface OwnerRecoveryCliIO {
  write(message: string): void;
  readLine(prompt: string): Promise<string>;
  readSecret(prompt: string): Promise<Buffer>;
  confirm(prompt: string): Promise<boolean>;
}

export interface OwnerRecoveryGenerationOptions {
  credentialPath: string;
  factorPath: string;
  privateDirectory: string;
}

class NodeOwnerRecoveryIO implements OwnerRecoveryCliIO {
  write(message: string): void {
    stdout.write(`${message}\n`);
  }

  async readLine(prompt: string): Promise<string> {
    const terminal = readline.createInterface({ input: stdin, output: stdout });
    try {
      return await terminal.question(prompt);
    } finally {
      terminal.close();
    }
  }

  readSecret(prompt: string): Promise<Buffer> {
    return readSecretFromTerminal(stdin, stdout, prompt);
  }

  async confirm(prompt: string): Promise<boolean> {
    return (await this.readLine(`${prompt} Type YES to continue: `)) === 'YES';
  }
}

export async function generateOwnerRecoveryCodes(
  options: OwnerRecoveryGenerationOptions,
  io: OwnerRecoveryCliIO,
  now: () => Date = () => new Date()
): Promise<void> {
  validateOptions(options);
  if (!(await io.confirm('Generate a new set of 10 one-time Owner recovery codes?'))) {
    throw new Error('Owner recovery code generation was not confirmed');
  }

  const password = await io.readSecret('Owner login password: ');
  try {
    const totpCode = (await io.readLine('Current six-digit authenticator code: ')).trim();
    const verifiedAt = now();
    const verified = await verifyOwnerTotpFactor(
      options.credentialPath,
      options.factorPath,
      password,
      totpCode,
      verifiedAt
    );
    if (!verified) {
      throw new Error('Owner authentication or MFA verification failed');
    }

    const credential = await loadCredential(options.credentialPath);
    const audit = new FileAuditStore(path.join(options.privateDirectory, 'audit'));
    const workflow = new FileOwnerRecoveryWorkflow(
      path.join(options.privateDirectory, 'recovery'),
      audit
    );
    const context = createKernelRequestContext({
      requestId: randomUUID(),
      correlationId: randomUUID(),
      environment: 'development',
      actor: {
        id: credential.subjectId,
        kind: 'owner',
        authenticated: true,
      },
      requestedAt: verifiedAt.toISOString(),
    });
    const request = {
      subjectId: credential.subjectId,
      providerId: 'local-owner',
      materialReference: 'local-owner-recovery/owner-mfa-recovery.json',
      context,
      occurredAt: verifiedAt,
    };
    const existing = await workflow.readRecoveryState();
    const generated = existing
      ? await workflow.regenerateRecoveryCodes({
          ...request,
          authenticated: true,
          mfaVerified: true,
        })
      : await workflow.generateRecoveryCodes(request);

    io.write('Owner recovery codes follow. They will not be displayed again.');
    for (const code of generated.codes) io.write(code);
    io.write('Store these codes in the Owner-controlled vault now.');
  } finally {
    password.fill(0);
  }
}

async function loadCredential(credentialPath: string): Promise<OwnerCredentialRecord> {
  const credential = JSON.parse(await readFile(credentialPath, 'utf8')) as OwnerCredentialRecord;
  if (credential.schemaVersion !== 1 || !credential.subjectId?.trim()) {
    throw new Error('Owner credential record is invalid');
  }
  return credential;
}

function validateOptions(options: OwnerRecoveryGenerationOptions): void {
  for (const [name, value] of [
    ['credentialPath', options.credentialPath],
    ['factorPath', options.factorPath],
    ['privateDirectory', options.privateDirectory],
  ] as const) {
    if (!path.isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  }
}

function parseOptions(args: readonly string[]): OwnerRecoveryGenerationOptions {
  if (args[0] !== 'generate') {
    throw new Error(
      'Usage: owner:recovery -- generate --credential <path> --factor <path> --private-dir <path>'
    );
  }
  const values: Record<string, string> = {};
  for (let index = 1; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || !value) throw new Error('Invalid CLI options');
    values[key.slice(2)] = path.resolve(value);
  }
  return {
    credentialPath: requireOption(values, 'credential'),
    factorPath: requireOption(values, 'factor'),
    privateDirectory: requireOption(values, 'private-dir'),
  };
}

function requireOption(options: Readonly<Record<string, string>>, name: string): string {
  const value = options[name];
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  generateOwnerRecoveryCodes(parseOptions(process.argv.slice(2)), new NodeOwnerRecoveryIO()).catch(
    (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Owner recovery code generation failed';
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    }
  );
}
