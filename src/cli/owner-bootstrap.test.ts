import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { readSecretFromTerminal } from '@/cli/owner-bootstrap';

function createTerminalInput() {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    setRawMode: (enabled: boolean) => void;
  };
  input.isTTY = true;
  input.setRawMode = vi.fn<(enabled: boolean) => void>();
  return input;
}

async function allowReadToStart(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('Owner Bootstrap terminal secret input', () => {
  it('supports consecutive hidden reads without destroying stdin', async () => {
    const input = createTerminalInput();
    const output = { write: vi.fn() };

    const firstRead = readSecretFromTerminal(input, output, 'First: ');
    await allowReadToStart();
    input.write(Buffer.from('first secret\r'));
    const first = await firstRead;

    expect(first.toString('utf8')).toBe('first secret');
    expect(input.destroyed).toBe(false);

    const secondRead = readSecretFromTerminal(input, output, 'Second: ');
    await allowReadToStart();
    input.write(Buffer.from('second secret\r'));
    const second = await secondRead;

    expect(second.toString('utf8')).toBe('second secret');
    expect(input.destroyed).toBe(false);
    expect(input.setRawMode).toHaveBeenNthCalledWith(1, true);
    expect(input.setRawMode).toHaveBeenNthCalledWith(2, false);
    expect(input.setRawMode).toHaveBeenNthCalledWith(3, true);
    expect(input.setRawMode).toHaveBeenNthCalledWith(4, false);
  });
});
