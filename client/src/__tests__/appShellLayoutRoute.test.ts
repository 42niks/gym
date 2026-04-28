import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// AppShell is a persistent layout route in App.tsx (not mounted inside each page).
//
// WHY this matters: every page used to wrap itself in <AppShell>. That caused
// Safari (especially iOS WebKit) to fully destroy and recreate the backdrop-blur
// header and blur-3xl decorative GPU compositing layers on every navigation,
// producing a visible lag. Keeping AppShell as a layout route means those layers
// are built once and never torn down.

const SRC = join(process.cwd(), 'client/src');

function listPageFiles(): string[] {
  const files: string[] = [];
  for (const sub of ['pages/owner', 'pages/member', 'pages']) {
    const dir = join(SRC, sub);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        files.push(join(dir, entry.name));
      }
    }
  }
  return files;
}

describe('AppShell layout route — Safari GPU compositing invariants', () => {
  it('AppShell renders <Outlet> for page content, not a children prop', () => {
    const src = readFileSync(join(SRC, 'components/AppShell.tsx'), 'utf8');

    expect(src).toContain('<Outlet');
    expect(src).not.toContain('children: React.ReactNode');
    expect(src).not.toContain('{children}');
  });

  it('no page file imports AppShell — pages must not wrap themselves in the shell', () => {
    // If a page imports AppShell, it will mount a second shell instance that
    // gets destroyed on every navigation, recreating all GPU layers in Safari.
    const violations = listPageFiles().filter(f =>
      readFileSync(f, 'utf8').includes('import AppShell'),
    );
    expect(violations).toEqual([]);
  });

  it('App.tsx mounts AppShell as a layout route, not inside individual pages', () => {
    const src = readFileSync(join(SRC, 'App.tsx'), 'utf8');

    // Must use the layout route pattern
    expect(src).toContain('<Route element={<AppShell');

    // AppShell import must exist at the App level
    expect(src).toContain("import AppShell from './components/AppShell");
  });
});
