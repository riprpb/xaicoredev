import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  executeOwnerBootstrapWorkflow,
  prepareOwnerBootstrapInput,
  type OwnerBootstrapWorkflowIO,
} from '@/identity/owner-bootstrap-workflow';

class NodeOwnerBootstrapIO implements OwnerBootstrapWorkflowIO {
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

  async readSecret(prompt: string): Promise<Buffer> {
    return readSecretFromTerminal(stdin, stdout, prompt);
  }

  async confirm(prompt: string): Promise<boolean> {
    return (await this.readLine(`${prompt} Type YES to continue: `)) === 'YES';
  }
}

interface SecretInputStream {
  readonly isTTY?: boolean;
  setRawMode?(enabled: boolean): void;
  resume(): void;
  pause(): void;
  on(event: 'data', listener: (chunk: unknown) => void): void;
  once(event: 'end', listener: () => void): void;
  once(event: 'error', listener: (error: unknown) => void): void;
  off(event: 'data', listener: (chunk: unknown) => void): void;
  off(event: 'end', listener: () => void): void;
  off(event: 'error', listener: (error: unknown) => void): void;
}

interface SecretOutputStream {
  write(message: string): unknown;
}

export async function readSecretFromTerminal(
  input: SecretInputStream,
  output: SecretOutputStream,
  prompt: string
): Promise<Buffer> {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Secret entry requires an interactive terminal');
  }
  output.write(prompt);
  input.setRawMode(true);
  const bytes: number[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
      input.setRawMode?.(false);
      input.pause();
    };
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      const secret = Buffer.from(bytes);
      bytes.fill(0);
      if (error) reject(error);
      else resolve(secret);
    };
    const onData = (chunk: unknown): void => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      for (const byte of buffer) {
        if (byte === 3) {
          finish(new Error('Secret entry cancelled'));
          return;
        }
        if (byte === 13 || byte === 10) {
          output.write('\n');
          finish();
          return;
        }
        if (byte === 8 || byte === 127) bytes.pop();
        else if (byte >= 32) bytes.push(byte);
      }
    };
    const onEnd = (): void => finish(new Error('Secret entry ended unexpectedly'));
    const onError = (error: unknown): void =>
      finish(error instanceof Error ? error : new Error('Secret entry failed'));

    input.on('data', onData);
    input.once('end', onEnd);
    input.once('error', onError);
    input.resume();
  });
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const options = parseOptions(args);
  const io = new NodeOwnerBootstrapIO();
  if (command === 'prepare') {
    await prepareOwnerBootstrapInput(
      {
        outputPath: requireOption(options, 'output'),
        constitutionPaths: [
          path.resolve('docs/constitution/01-foundation.md'),
          path.resolve('docs/constitution/02-governance.md'),
          path.resolve('docs/constitution/03-system-kernel.md'),
          path.resolve('docs/constitution/04-ai-and-memory.md'),
          path.resolve('docs/constitution/05-security-and-trust.md'),
        ],
        successorTrustPolicyReference: 'successor-policy/local-v1',
      },
      io
    );
    return;
  }
  if (command === 'execute') {
    await executeOwnerBootstrapWorkflow(
      {
        inputPath: requireOption(options, 'input'),
        privateDirectory: requireOption(options, 'private-dir'),
        recoveryDirectory: requireOption(options, 'recovery-dir'),
      },
      io
    );
    return;
  }
  throw new Error('Usage: owner-bootstrap <prepare|execute> [options]');
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
    const message = error instanceof Error ? error.message : 'Owner Bootstrap failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
