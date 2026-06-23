import readline from 'node:readline/promises';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';
import { readSecretFromTerminal } from '@/cli/owner-bootstrap';
import {
  provisionOwnerCredential,
  type OwnerCredentialWorkflowIO,
} from '@/identity/owner-credential-workflow';
import { LocalPasswordDenylist } from '@/identity/local-credentials';

const COMPROMISED_PASSWORD_FINGERPRINTS = [
  '2e2b24f8ee40bb847fe85bb23336a39ef5948e6b49d897419ced68766b16967a',
  'c4bbcb1fbec99d65bf59d85c8cb62ee2db963f0fe106f483d9afa73bd4e39a8a',
  '565881db2cc09de0cd280e4d89892987c10b23b5ef88cfea16830a69c9e9f5bb',
] as const;

class NodeCredentialIO implements OwnerCredentialWorkflowIO {
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

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  await provisionOwnerCredential(
    {
      ownerRecordPath: requireOption(options, 'owner-record'),
      privateDirectory: requireOption(options, 'private-dir'),
    },
    new NodeCredentialIO(),
    new LocalPasswordDenylist(COMPROMISED_PASSWORD_FINGERPRINTS)
  );
}

function parseOptions(args: readonly string[]): Readonly<Record<string, string>> {
  const options: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || !value) throw new Error('Invalid CLI options');
    options[key.slice(2)] = path.resolve(value);
  }
  return options;
}

function requireOption(options: Readonly<Record<string, string>>, name: string): string {
  const value = options[name];
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Owner credential setup failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
