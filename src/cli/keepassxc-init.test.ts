import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createKeePassXcImportXml,
  initializeKeePassXcXml,
  XAICORE_KEEPASSXC_GROUPS,
} from '@/cli/keepassxc-init';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-keepassxc-'));
  directories.push(directory);
  return directory;
}

describe('KeePassXC empty vault initializer', () => {
  it('creates the approved group hierarchy and title-only empty entries', () => {
    const xml = createKeePassXcImportXml();

    expect(xml).toContain('<Name>Root</Name>');
    for (const group of XAICORE_KEEPASSXC_GROUPS) {
      expect(xml).toContain(`<Name>${group.name}</Name>`);
      for (const entry of group.entries) {
        expect(xml).toContain(`<Value>${entry}</Value>`);
      }
    }

    expect(xml).toContain('<Key>Password</Key>\n            <Value></Value>');
    expect(xml).toContain('<Key>UserName</Key>\n            <Value></Value>');
    expect(xml).not.toContain('otpauth://');
    expect(xml).not.toContain('BEGIN');
    expect(xml).not.toContain('secret=');
  });

  it('writes a new XML file and refuses to overwrite it', async () => {
    const output = path.join(await tempDirectory(), 'xaicore-empty-vault.xml');

    await initializeKeePassXcXml(output);
    await expect(readFile(output, 'utf8')).resolves.toContain(
      'XAICore KeePassXC Empty Vault Initializer'
    );
    await expect(initializeKeePassXcXml(output)).rejects.toThrow();
  });

  it('requires an XML import target instead of pretending to create a database', async () => {
    await expect(initializeKeePassXcXml(path.join(await tempDirectory(), 'vault.kdbx'))).rejects.toThrow(
      'XML import file'
    );
  });
});
