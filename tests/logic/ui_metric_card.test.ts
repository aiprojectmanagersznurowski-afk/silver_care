import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { MetricCard, MetricGrid } from '../../apps/web/src/components/patterns/MetricCard';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-INTERPRETATION
 *
 * Karta wskaźnika jak w szablonie shadcn-admin (kafel ikony, etykieta, wartość, opis),
 * ale bez gradientu i bez plakietki trendu: metryka jest faktem, nie oceną (ADR-005).
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement: h } = requireWeb('react') as typeof import('react');
const html = (el: unknown) => renderToStaticMarkup(el as never);

describe('MetricCard — karta wskaźnika placówki', () => {
  const out = html(h(MetricCard as never, { icon: h('svg', null), label: 'Wolne łóżka', value: 12, description: 'Łóżka bez przypisania.' }));

  it('@REQ: UI-TEMPLATE-ALIGNMENT - układ szablonu: kafel ikony, etykieta, wartość text-3xl tabular-nums, opis', () => {
    expect(out).toContain('data-slot="metric-card"');
    expect(out).toContain('data-slot="card"');
    expect(out).toMatch(/data-slot="metric-icon"[^>]*class="[^"]*size-7[^"]*rounded-lg[^"]*border[^"]*bg-muted/);
    expect(out).toMatch(/data-slot="card-description"[^>]*>Wolne łóżka</);
    expect(out).toMatch(/data-slot="metric-value"[^>]*class="[^"]*text-3xl[^"]*tabular-nums[^"]*"[^>]*>12</);
    expect(out).toMatch(/class="[^"]*text-muted-foreground[^"]*text-sm[^"]*"[^>]*>Łóżka bez przypisania\.</);
  });

  it('@REQ: MDR-NO-INTERPRETATION - bez gradientu, bez trendu i bez czerwieni', () => {
    expect(out).not.toMatch(/gradient|bg-linear|from-|Trending|destructive/);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - siatka kart wskaźników jak w szablonie', () => {
    const grid = html(h(MetricGrid as never, null, h('div', null)));
    const cls = grid.match(/data-slot="metric-grid"[^>]*class="([^"]+)"/)?.[1] ?? '';
    expect(cls.split(' ')).toEqual(expect.arrayContaining(['grid', 'grid-cols-1', 'gap-4', 'sm:grid-cols-2', 'xl:grid-cols-4']));
  });
});
