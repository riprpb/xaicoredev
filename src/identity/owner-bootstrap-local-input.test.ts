import { chmod, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createOwnerBootstrapRequest,
  loadOwnerBootstrapLocalInput,
} from '@/identity/owner-bootstrap-local-input';
import { createKernelRequestContext } from '@/platform/kernel/context';

const directories: string[] = [];
const occurredAt = '2026-06-22T12:00:00.000Z';
const validInput = {
  schemaVersion: 1,
  ceremonyId: 'ceremony-test-1',
  candidateSubjectId: 'owner-subject-test',
  ownerAccount: {
    displayName: 'Synthetic Owner',
    primaryEmail: 'owner@example.test',
  },
  constitutionalAcceptance: {
    documentId: 'xaicore-constitution',
    version: '1',
    documentDigest: 'digest-test',
    acceptedAt: occurredAt,
  },
  successorTrustPolicyReference: 'successor-policy/test-v1',
  reason: 'synthetic local input test',
};

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function createInputFile(value: unknown = validInput): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-input-test-'));
  directories.push(directory);
  const filePath = path.join(directory, 'test.owner-bootstrap.local.json');
  await writeFile(filePath, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return filePath;
}

describe('Owner Bootstrap local input', () => {
  it('loads and freezes approved local identity metadata', async () => {
    const filePath = await createInputFile();
    const input = await loadOwnerBootstrapLocalInput(filePath);

    expect(input).toEqual(validInput);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.ownerAccount)).toBe(true);
    expect(Object.isFrozen(input.constitutionalAcceptance)).toBe(true);

    const context = createKernelRequestContext({
      requestId: 'request-test',
      correlationId: 'correlation-test',
      environment: 'test',
      actor: { id: 'input-test', kind: 'service', authenticated: true },
      requestedAt: occurredAt,
    });
    expect(createOwnerBootstrapRequest(input, context)).toEqual(
      expect.objectContaining({
        candidateSubjectId: validInput.candidateSubjectId,
        context,
      })
    );
  });

  it('rejects relative paths, wrong suffixes, and symlinks', async () => {
    await expect(loadOwnerBootstrapLocalInput('relative.local.json')).rejects.toThrow(
      'must be absolute'
    );
    const filePath = await createInputFile();
    await expect(
      loadOwnerBootstrapLocalInput(path.join(path.dirname(filePath), 'wrong.json'))
    ).rejects.toThrow('protected local filename suffix');
    const linkPath = path.join(path.dirname(filePath), 'link.owner-bootstrap.local.json');
    await symlink(filePath, linkPath);
    await expect(loadOwnerBootstrapLocalInput(linkPath)).rejects.toThrow(
      'regular non-symlink file'
    );
  });

  it('rejects invalid JSON, unknown fields, and password fields', async () => {
    const invalidJsonPath = await createInputFile();
    await writeFile(invalidJsonPath, '{invalid', 'utf8');
    await expect(loadOwnerBootstrapLocalInput(invalidJsonPath)).rejects.toThrow('not valid JSON');

    const unknownFieldPath = await createInputFile({ ...validInput, password: 'forbidden' });
    await expect(loadOwnerBootstrapLocalInput(unknownFieldPath)).rejects.toThrow(
      'unsupported fields'
    );
  });

  it('rejects malformed profile and ceremony metadata', async () => {
    const invalidEmailPath = await createInputFile({
      ...validInput,
      ownerAccount: { ...validInput.ownerAccount, primaryEmail: 'invalid' },
    });
    await expect(loadOwnerBootstrapLocalInput(invalidEmailPath)).rejects.toThrow(
      'primaryEmail is invalid'
    );

    const invalidAcceptancePath = await createInputFile({
      ...validInput,
      constitutionalAcceptance: {
        ...validInput.constitutionalAcceptance,
        acceptedAt: 'invalid',
      },
    });
    await expect(loadOwnerBootstrapLocalInput(invalidAcceptancePath)).rejects.toThrow(
      'acceptedAt is invalid'
    );
  });

  it('rejects overly broad permissions on platforms that expose POSIX modes', async () => {
    if (process.platform === 'win32') return;
    const filePath = await createInputFile();
    await chmod(filePath, 0o644);
    await expect(loadOwnerBootstrapLocalInput(filePath)).rejects.toThrow(
      'permissions are too broad'
    );
  });
});
