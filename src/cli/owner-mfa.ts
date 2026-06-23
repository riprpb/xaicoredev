import readline from 'node:readline/promises';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';
import { readSecretFromTerminal } from '@/cli/owner-bootstrap';
import { enrollOwnerTotp, type OwnerMfaWorkflowIO } from '@/identity/owner-mfa-workflow';

class NodeMfaIO implements OwnerMfaWorkflowIO {
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
  await enrollOwnerTotp(
    {
      credentialPath: requireOption(options, 'credential'),
      privateDirectory: requireOption(options, 'private-dir'),
      accountLabel: 'XAICore Owner',
    },
    new NodeMfaIO()
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
    const message = error instanceof Error ? error.message : 'Owner MFA enrollment failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
