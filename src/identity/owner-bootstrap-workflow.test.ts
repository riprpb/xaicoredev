import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  executeOwnerBootstrapWorkflow,
  prepareOwnerBootstrapInput,
  type OwnerBootstrapWorkflowIO,
} from '@/identity/owner-bootstrap-workflow';

const directories: string[] = [];
const occurredAt = '2026-06-22T12:00:00.000Z';

class TestWorkflowIO implements OwnerBootstrapWorkflowIO {
  readonly output: string[] = [];
  readonly lines = ['Synthetic Owner', 'owner@example.test'];
  confirmed = true;
  secret = 'synthetic recovery passphrase';

  write(message: string): void {
    this.output.push(message);
  }

  async readLine(): Promise<string> {
    return this.lines.shift() ?? '';
  }

  async readSecret(): Promise<Buffer> {
    return Buffer.from(this.secret, 'utf8');
  }

  async confirm(): Promise<boolean> {
    return this.confirmed;
  }
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function createWorkspace() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-workflow-test-'));
  directories.push(directory);
  const constitutionPath = path.join(directory, 'constitution.md');
  await writeFile(constitutionPath, '# Synthetic Constitution', 'utf8');
  return {
    directory,
    constitutionPath,
    inputPath: path.join(directory, 'input.owner-bootstrap.local.json'),
    privateDirectory: path.join(directory, 'private'),
    recoveryDirectory: path.join(directory, 'recovery'),
  };
}

describe('Owner Bootstrap workflow', () => {
  it('prepares and executes a complete synthetic local ceremony', async () => {
    const workspace = await createWorkspace();
    const io = new TestWorkflowIO();
    const now = () => new Date(occurredAt);

    const input = await prepareOwnerBootstrapInput(
      {
        outputPath: workspace.inputPath,
        constitutionPaths: [workspace.constitutionPath],
        successorTrustPolicyReference: 'successor-policy/local-v1',
      },
      io,
      now
    );
    expect(input.ownerAccount.primaryEmail).toBe('owner@example.test');

    const result = await executeOwnerBootstrapWorkflow(
      {
        inputPath: workspace.inputPath,
        privateDirectory: workspace.privateDirectory,
        recoveryDirectory: workspace.recoveryDirectory,
      },
      io,
      now
    );

    expect(result.recordId).toMatch(/^[0-9a-f-]{36}$/);
    expect(io.output.at(-1)).toContain('Owner Bootstrap completed');
  }, 30_000);

  it('requires constitutional and execution confirmation', async () => {
    const preparation = await createWorkspace();
    const preparationIO = new TestWorkflowIO();
    preparationIO.confirmed = false;
    await expect(
      prepareOwnerBootstrapInput(
        {
          outputPath: preparation.inputPath,
          constitutionPaths: [preparation.constitutionPath],
          successorTrustPolicyReference: 'successor-policy/local-v1',
        },
        preparationIO
      )
    ).rejects.toThrow('Constitutional acceptance is required');

    const execution = await createWorkspace();
    const prepareIO = new TestWorkflowIO();
    await prepareOwnerBootstrapInput(
      {
        outputPath: execution.inputPath,
        constitutionPaths: [execution.constitutionPath],
        successorTrustPolicyReference: 'successor-policy/local-v1',
      },
      prepareIO
    );
    const executeIO = new TestWorkflowIO();
    executeIO.confirmed = false;
    await expect(
      executeOwnerBootstrapWorkflow(
        {
          inputPath: execution.inputPath,
          privateDirectory: execution.privateDirectory,
          recoveryDirectory: execution.recoveryDirectory,
        },
        executeIO
      )
    ).rejects.toThrow('execution was not confirmed');
  });

  it('rejects mismatched recovery passphrases and unsafe paths', async () => {
    const workspace = await createWorkspace();
    const prepareIO = new TestWorkflowIO();
    await prepareOwnerBootstrapInput(
      {
        outputPath: workspace.inputPath,
        constitutionPaths: [workspace.constitutionPath],
        successorTrustPolicyReference: 'successor-policy/local-v1',
      },
      prepareIO
    );
    const executeIO = new TestWorkflowIO();
    let secretRead = 0;
    executeIO.readSecret = async () =>
      Buffer.from(secretRead++ === 0 ? 'first recovery passphrase' : 'second mismatch');
    await expect(
      executeOwnerBootstrapWorkflow(
        {
          inputPath: workspace.inputPath,
          privateDirectory: workspace.privateDirectory,
          recoveryDirectory: workspace.recoveryDirectory,
        },
        executeIO
      )
    ).rejects.toThrow('failed safely');
    await expect(
      access(path.join(workspace.privateDirectory, 'record', 'owner-bootstrap.record.json'))
    ).rejects.toThrow();
    await expect(
      access(path.join(workspace.recoveryDirectory, 'owner-recovery.package'))
    ).rejects.toThrow();

    await expect(
      executeOwnerBootstrapWorkflow(
        {
          inputPath: workspace.inputPath,
          privateDirectory: workspace.privateDirectory,
          recoveryDirectory: path.join(workspace.privateDirectory, 'recovery'),
        },
        executeIO
      )
    ).rejects.toThrow('must be separate');
  }, 30_000);
});
