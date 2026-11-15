export interface LimitCustom {
  suffix: string;
  max: number;
  current?: number;
}

export function parseCustomLimit(text: string, custom: LimitCustom): { value: number } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Enter a number' };
  if (!/^\d+$/.test(trimmed)) return { error: 'Use a whole number' };
  const value = Number(trimmed);
  if (value > custom.max) return { error: `At most ${custom.max} ${custom.suffix}` };
  return { value };
}
