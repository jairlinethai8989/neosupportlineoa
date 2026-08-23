import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { assertImportableLineMediaProvider, readLineMediaWithLimit } from './mediaSecurity';

describe('assertImportableLineMediaProvider', () => {
  it('allows LINE-hosted content and rejects external or unknown providers', () => {
    expect(() => assertImportableLineMediaProvider(undefined)).not.toThrow();
    expect(() => assertImportableLineMediaProvider('line')).not.toThrow();
    expect(() => assertImportableLineMediaProvider('external')).toThrow('External LINE media import is disabled');
    expect(() => assertImportableLineMediaProvider('unknown')).toThrow('Unsupported LINE media provider');
  });
});

describe('readLineMediaWithLimit', () => {
  it('reads bounded media and stops oversized streams', async () => {
    await expect(readLineMediaWithLimit(Readable.from([Buffer.from('ab'), Buffer.from('cd')]), 4)).resolves.toEqual(
      Buffer.from('abcd')
    );
    await expect(readLineMediaWithLimit(Readable.from([Buffer.alloc(3), Buffer.alloc(3)]), 5)).rejects.toThrow(
      'LINE media is too large'
    );
  });
});
