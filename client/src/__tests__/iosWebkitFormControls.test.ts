import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'client/src/index.css'), 'utf8');

function cssBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`, 'm').exec(css);
  return match?.[1] ?? '';
}

describe('iOS WebKit form control regressions', () => {
  it('keeps shared form controls at 16px to prevent iOS Safari focus zoom', () => {
    const fieldControl = cssBlock('.field-control');

    expect(fieldControl).toContain('text-base');
    expect(fieldControl).not.toContain('text-sm');
  });

  it('keeps appearance reset and width containment on shared form controls', () => {
    const fieldControl = cssBlock('.field-control');

    expect(fieldControl).toContain('min-width: 0;');
    expect(fieldControl).toContain('max-width: 100%;');
    expect(fieldControl).toContain('-webkit-appearance: none;');
    expect(fieldControl).toContain('appearance: none;');
  });

  it('gives iOS WebKit date inputs an explicit outer and inner line box', () => {
    const dateControl = cssBlock(".field-control[type='date']");
    const dateValue = cssBlock(".field-control[type='date']::-webkit-date-and-time-value");
    const dateIndicator = cssBlock(".field-control[type='date']::-webkit-calendar-picker-indicator");

    expect(dateControl).toContain('display: block;');
    expect(dateControl).toContain('min-height: 3rem;');
    expect(dateControl).toContain('line-height: 1.25rem;');

    expect(dateValue).toContain('display: block;');
    expect(dateValue).toContain('min-height: 1.25rem;');
    expect(dateValue).toContain('line-height: 1.25rem;');
    expect(dateValue).toContain('color: currentColor;');

    expect(dateIndicator).toContain('min-height: 1.25rem;');
  });
});
