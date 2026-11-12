import { examples } from '@/features/execution/provider';

export interface PlaygroundSnapshot { exampleId: string; code: string }

export function parsePlaygroundSnapshot(value: string | null): PlaygroundSnapshot | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const data = parsed as Partial<PlaygroundSnapshot>;
    if (typeof data.exampleId !== 'string' || typeof data.code !== 'string' || !examples.some((example) => example.id === data.exampleId)) return null;
    return { exampleId: data.exampleId, code: data.code };
  } catch { return null; }
}
