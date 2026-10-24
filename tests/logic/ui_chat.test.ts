import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { ChatBubble, ChatDateSeparator, ChatComposer, ChatSendButton } from '../../apps/web/src/components/patterns/Chat';

/**
 * @REQ: FAM-MESSAGES
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Jeden wygląd czatu w portalu rodziny i w skrzynce kierownika placówki:
 * te same dymki, separator daty, pole wiadomości i przycisk wysyłania.
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement: h } = requireWeb('react') as typeof import('react');
const html = (el: unknown) => renderToStaticMarkup(el as never);

describe('Wspólne komponenty czatu', () => {
  it('@REQ: FAM-MESSAGES - dymek własny w kolorze marki po prawej, cudzy na karcie po lewej', () => {
    const own = html(h(ChatBubble as never, { own: true, meta: '12:30 · Ty' }, 'Dzień dobry'));
    const other = html(h(ChatBubble as never, { own: false, meta: '12:31 · Personel' }, 'Witam'));
    expect(own).toMatch(/data-slot="chat-bubble"[^>]*data-own="true"/);
    expect(own).toMatch(/class="[^"]*items-end/);
    expect(own).toMatch(/class="[^"]*bg-primary[^"]*text-primary-foreground[^"]*rounded-br-sm/);
    expect(other).toMatch(/class="[^"]*items-start/);
    expect(other).toMatch(/class="[^"]*bg-card[^"]*border[^"]*rounded-bl-sm/);
    expect(own).toMatch(/data-slot="chat-meta"[^>]*class="[^"]*text-xs[^"]*text-muted-foreground[^"]*"[^>]*>12:30 · Ty</);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - separator daty jak plakietka szablonu', () => {
    const out = html(h(ChatDateSeparator as never, null, 'czwartek, 23 października'));
    expect(out).toMatch(/data-slot="chat-date"[^>]*>.*czwartek, 23 października/);
    expect(out).toMatch(/class="[^"]*text-xs[^"]*text-muted-foreground/);
  });

  it('@REQ: UI-ACCESSIBILITY - pole wiadomości i okrągły przycisk wysyłania z celem dotykowym i etykietą', () => {
    const bar = html(h(ChatComposer as never, null, h('input', { 'aria-label': 'Wiadomość' })));
    expect(bar).toMatch(/data-slot="chat-composer"[^>]*class="[^"]*border-t/);
    expect(bar).toMatch(/data-slot="chat-input"[^>]*class="[^"]*rounded-2xl/);
    const send = html(h(ChatSendButton as never, { disabled: false }));
    expect(send).toMatch(/<button[^>]*type="submit"[^>]*class="[^"]*size-touch[^"]*rounded-full/);
    expect(send).toContain('Wyślij');
  });
});
