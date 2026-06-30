import { createHash } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { stderr, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';

interface VaultGroup {
  readonly name: string;
  readonly entries: readonly string[];
}

export const XAICORE_KEEPASSXC_GROUPS: readonly VaultGroup[] = [
  {
    name: '00 - Emergency',
    entries: [
      'Emergency access instructions',
      'Owner recovery package location',
      'Break-glass contact record',
      'Emergency approval evidence',
    ],
  },
  {
    name: '01 - Owner Identity',
    entries: [
      'Constitutional Owner identity',
      'XAICore Owner local login',
      'Owner MFA authenticator',
      'Owner recovery key',
      'Successor trust framework',
    ],
  },
  {
    name: '02 - XAICore',
    entries: [
      'XAICore platform admin',
      'Kernel authority record',
      'Haley Core dashboard',
      'Feature Flag privileged action',
      'Audit viewer',
    ],
  },
  {
    name: '03 - Email',
    entries: [
      'Primary Owner email',
      'Recovery email',
      'Domain administrator email',
      'Security alerts mailbox',
    ],
  },
  {
    name: '04 - Domains',
    entries: [
      'Primary domain registrar',
      'DNS provider',
      'TLS certificate authority',
      'Registry lock or WHOIS protection',
    ],
  },
  {
    name: '05 - Servers',
    entries: [
      'Local development workstation',
      'Staging server',
      'Production server',
      'Backup server',
      'Monitoring endpoint',
    ],
  },
  {
    name: '06 - Development',
    entries: ['GitHub account', 'Git signing key', 'npm registry', 'CI runner', 'Local database'],
  },
  {
    name: '07 - Database',
    entries: [
      'PostgreSQL administrator',
      'PostgreSQL application role',
      'Database backup encryption reference',
      'Database restore validation record',
    ],
  },
  {
    name: '08 - Security',
    entries: [
      'KeePassXC vault master key reminder',
      'Owner MFA seed',
      'Recovery passphrase',
      'Root Authority evidence',
      'Audit integrity material',
    ],
  },
  {
    name: '09 - API Keys',
    entries: [
      'OpenAI API key',
      'Email provider API key',
      'DNS provider API key',
      'Monitoring provider API key',
      'Payment provider placeholder',
    ],
  },
  {
    name: '10 - Finance',
    entries: ['Business bank', 'Accounting system', 'Tax records portal', 'Payment processor'],
  },
  {
    name: '11 - Personal',
    entries: [
      'Personal identity documents',
      'Personal recovery contact',
      'Personal device PIN record',
    ],
  },
  {
    name: '12 - Recovery',
    entries: [
      'XAICore recovery package',
      'Offline backup location',
      'Successor activation packet',
      'Hardware security key inventory',
    ],
  },
] as const;

export async function initializeKeePassXcXml(outputPath: string): Promise<void> {
  const resolvedOutputPath = path.resolve(outputPath);
  if (!resolvedOutputPath.toLowerCase().endsWith('.xml')) {
    throw new Error('KeePassXC initializer output must be an XML import file');
  }

  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  const handle = await open(resolvedOutputPath, 'wx', 0o600);
  try {
    await handle.writeFile(createKeePassXcImportXml(), 'utf8');
  } finally {
    await handle.close();
  }
}

export function createKeePassXcImportXml(): string {
  const rootGroups = XAICORE_KEEPASSXC_GROUPS.map((group) => renderGroup(group)).join('\n');
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<KeePassFile>',
    '  <Meta>',
    '    <Generator>XAICore KeePassXC Empty Vault Initializer</Generator>',
    '    <DatabaseName>XAICore Empty Vault</DatabaseName>',
    '  </Meta>',
    '  <Root>',
    '    <Group>',
    `      <UUID>${uuid('root')}</UUID>`,
    '      <Name>Root</Name>',
    '      <Notes></Notes>',
    rootGroups,
    '    </Group>',
    '  </Root>',
    '</KeePassFile>',
    '',
  ].join('\n');
}

function renderGroup(group: VaultGroup): string {
  const entries = group.entries
    .map((entry) => renderEntry(`${group.name}/${entry}`, entry))
    .join('\n');
  return [
    '      <Group>',
    `        <UUID>${uuid(group.name)}</UUID>`,
    `        <Name>${xml(group.name)}</Name>`,
    '        <Notes></Notes>',
    entries,
    '      </Group>',
  ].join('\n');
}

function renderEntry(identity: string, title: string): string {
  return [
    '        <Entry>',
    `          <UUID>${uuid(identity)}</UUID>`,
    stringField('Title', title),
    stringField('UserName', ''),
    stringField('Password', ''),
    stringField('URL', ''),
    stringField('Notes', ''),
    '        </Entry>',
  ].join('\n');
}

function stringField(key: string, value: string): string {
  return [
    '          <String>',
    `            <Key>${xml(key)}</Key>`,
    `            <Value>${xml(value)}</Value>`,
    '          </String>',
  ].join('\n');
}

function uuid(value: string): string {
  return createHash('sha256')
    .update(`xaicore-keepassxc:${value}`)
    .digest()
    .subarray(0, 16)
    .toString('base64');
}

function xml(value: string): string {
  return value
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;')
    .split('"')
    .join('&quot;')
    .split("'")
    .join('&apos;');
}

function parseOutput(args: readonly string[]): string {
  if (args.length !== 2 || args[0] !== '--output') {
    throw new Error('Usage: npm run keepassxc:init -- --output <path-to-empty-import.xml>');
  }
  return args[1]!;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  initializeKeePassXcXml(parseOutput(process.argv.slice(2)))
    .then(() => {
      stdout.write('KeePassXC empty vault import XML initialized.\n');
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'KeePassXC initialization failed';
      stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
