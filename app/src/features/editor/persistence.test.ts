import { describe, expect, it } from 'vitest';
import { parsePlaygroundSnapshot } from './persistence';

describe('playground persisted draft', () => {
  it('restores supported sample identities and arbitrary user draft text', () => {
    expect(parsePlaygroundSnapshot(JSON.stringify({ exampleId: 'loops', code: 'my draft' }))).toEqual({ exampleId: 'loops', code: 'my draft' });
  });
  it('ignores corrupt and old snapshots without sending invalid values to execution', () => {
    for (const value of [null, '{broken', 'null', '[]', '{"exampleId":"loops"}', '{"exampleId":"loops","code":42}', '{"exampleId":"missing","code":"draft"}']) expect(parsePlaygroundSnapshot(value)).toBeNull();
  });
});
