import { describe, expect, it } from 'vitest';
import { MockExecutionProvider, examples } from './provider';

describe('educational execution provider', () => {
  const provider = new MockExecutionProvider();
  it('returns an ordered deterministic trace with the loop accumulator', async () => {
    const result = await provider.execute({ code: examples[1].code });
    expect(result.supported).toBe(true);
    expect(result.output.at(-1)).toBe('Total: 15');
    expect(result.events.map((event) => event.sequence)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(result.events[5].variables.total).toBe('6');
  });
  it('rejects modified examples rather than pretending to compile them', async () => {
    const result = await provider.execute({ code: examples[0].code.replace('10', '99') });
    expect(result.supported).toBe(false);
    expect(result.events).toEqual([]);
    expect(result.diagnostic).toBeTruthy();
  });
  it('does not let consumers mutate fixture traces', async () => {
    const first = await provider.execute({ code: examples[0].code });
    first.events[0].variables.name = 'changed';
    const second = await provider.execute({ code: examples[0].code });
    expect(second.events[0].variables.name).toBe('"BitroLearn"');
  });
});

