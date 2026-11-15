export interface LimitCustom {
  prefix?: string;
  suffix?: string;
  decimal: boolean;
  max: number;
  current?: number;
}

export function parseCustomLimit(text: string, custom: LimitCustom): { value: number } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Enter a number' };
  const pattern = custom.decimal ? /^\d+(\.\d{1,2})?$/ : /^\d+$/;
  if (!pattern.test(trimmed)) return { error: custom.decimal ? 'Use a number like 12 or 12.50' : 'Use a whole number' };
  const value = Number(trimmed);
  if (value > custom.max) return { error: `At most ${custom.prefix ?? ''}${custom.max}${custom.suffix ? ` ${custom.suffix}` : ''}` };
  return { value };
}
