import { describe, it, expect, afterEach } from 'vitest'
import { callEuLlmCompletion } from '../../apps/web/src/lib/eu-llm-client'
import { PROVIDERS } from '../../contracts/integration.contract.mjs'

/**
 * @REQ: INFRA-GROQ-DEMO-INTERIM
 *
 * ADR-015: tymczasowy fallback CLASSIFY/GENERATE na Groq, wyłącznie na czas demo,
 * przed podpisaniem DPA. Domyślnie wyłączony (PR #38 bez zmian) — wymaga jawnej,
 * osobnej od GROQ_API_KEY zmiennej ALLOW_DEMO_GROQ_FALLBACK=true.
 */

const ENV_KEYS = ['EU_LLM_API_KEY', 'MISTRAL_API_KEY', 'GROQ_API_KEY', 'EU_LLM_ENDPOINT', 'ALLOW_DEMO_GROQ_FALLBACK'] as const

function withEnv(vars: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => Promise<void> | void) {
  const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const)
  return (async () => {
    try {
      for (const k of ENV_KEYS) delete process.env[k]
      for (const [k, v] of Object.entries(vars)) process.env[k as (typeof ENV_KEYS)[number]] = v
      await fn()
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  })()
}

describe('Tryb demo Groq dla CLASSIFY/GENERATE (@REQ: INFRA-GROQ-DEMO-INTERIM)', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('AC1: sama obecność GROQ_API_KEY bez ALLOW_DEMO_GROQ_FALLBACK nadal kończy się [EU-LLM-CONFIG] @REQ: INFRA-GROQ-DEMO-INTERIM', async () => {
    let fetchCalls = 0
    globalThis.fetch = (async () => {
      fetchCalls++
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) } as any
    }) as any

    await withEnv({ GROQ_API_KEY: 'test_groq_key' }, async () => {
      await expect(callEuLlmCompletion([{ role: 'user', content: 'test' }])).rejects.toThrow(/EU-LLM-CONFIG/)
    })
    expect(fetchCalls).toBe(0)
  })

  it('AC2: ALLOW_DEMO_GROQ_FALLBACK=true + GROQ_API_KEY, bez klucza EU, kieruje do Groq i zwraca treść @REQ: INFRA-GROQ-DEMO-INTERIM', async () => {
    const calls: any[] = []
    globalThis.fetch = (async (url: string, opts: any) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Raport demo z Groq' } }] }) } as any
    }) as any

    await withEnv({ GROQ_API_KEY: 'test_groq_key', ALLOW_DEMO_GROQ_FALLBACK: 'true' }, async () => {
      const result = await callEuLlmCompletion([{ role: 'user', content: 'test' }])
      expect(result).toBe('Raport demo z Groq')
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(calls[0].body.model).toBe('llama-3.3-70b-versatile')
  })

  it('AC2: wywołanie w trybie demo loguje ostrzeżenie bez treści promptu @REQ: INFRA-GROQ-DEMO-INTERIM', async () => {
    globalThis.fetch = (async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) }) as any) as any
    const warnSpy: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => { warnSpy.push(args.map(String).join(' ')) }

    try {
      await withEnv({ GROQ_API_KEY: 'test_groq_key', ALLOW_DEMO_GROQ_FALLBACK: 'true' }, async () => {
        await callEuLlmCompletion([{ role: 'user', content: 'TAJNA TREŚĆ NOTATKI' }])
      })
    } finally {
      console.warn = originalWarn
    }

    const joined = warnSpy.join('\n')
    expect(joined).toMatch(/EU-LLM-DEMO-FALLBACK/)
    expect(joined).not.toContain('TAJNA TREŚĆ NOTATKI')
  })

  it('AC3: klucz EU ma pierwszeństwo nad trybem demo, nawet gdy oba są obecne @REQ: INFRA-GROQ-DEMO-INTERIM', async () => {
    const calls: string[] = []
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Raport z EU' } }] }) } as any
    }) as any

    await withEnv(
      { EU_LLM_API_KEY: 'test_eu_key', EU_LLM_ENDPOINT: 'https://mistral.ai/v1/chat/completions', GROQ_API_KEY: 'test_groq_key', ALLOW_DEMO_GROQ_FALLBACK: 'true' },
      async () => {
        const result = await callEuLlmCompletion([{ role: 'user', content: 'test' }])
        expect(result).toBe('Raport z EU')
      },
    )
    expect(calls).toEqual(['https://mistral.ai/v1/chat/completions'])
  })

  it('AC4: nieprawidłowy EU_LLM_ENDPOINT nadal odrzucany, niezależnie od trybu demo @REQ: INFRA-GROQ-DEMO-INTERIM', async () => {
    let fetchCalls = 0
    globalThis.fetch = (async () => {
      fetchCalls++
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) } as any
    }) as any

    await withEnv(
      { EU_LLM_API_KEY: 'test_eu_key', EU_LLM_ENDPOINT: 'https://api.groq.com/openai/v1/chat/completions', ALLOW_DEMO_GROQ_FALLBACK: 'true' },
      async () => {
        await expect(callEuLlmCompletion([{ role: 'user', content: 'test' }])).rejects.toThrow(/EU-LLM-REGION/)
      },
    )
    expect(fetchCalls).toBe(0)
  })

  it('AC2: ALLOW_DEMO_GROQ_FALLBACK bez GROQ_API_KEY nie aktywuje trybu demo @REQ: INFRA-GROQ-DEMO-INTERIM', async () => {
    let fetchCalls = 0
    globalThis.fetch = (async () => {
      fetchCalls++
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) } as any
    }) as any

    await withEnv({ ALLOW_DEMO_GROQ_FALLBACK: 'true' }, async () => {
      await expect(callEuLlmCompletion([{ role: 'user', content: 'test' }])).rejects.toThrow(/EU-LLM-CONFIG/)
    })
    expect(fetchCalls).toBe(0)
  })

  it('AC5: wpis GROQ_DEMO_LLM w PROVIDERS ma transferMechanism, exceptionApprovedBy i exceptionReason zgodnie z R22 @REQ: INFRA-GROQ-DEMO-INTERIM', () => {
    const entry = PROVIDERS.find((p: any) => p.id === 'GROQ_DEMO_LLM')
    expect(entry).toBeDefined()
    expect(entry!.transferMechanism).toBeTruthy()
    expect(entry!.exceptionApprovedBy).toBeTruthy()
    expect(entry!.exceptionReason).toBeTruthy()
    expect(entry!.exceptionReason!.length).toBeGreaterThanOrEqual(40)
    // Jawnie stwierdza brak DPA i ograniczenie do danych syntetycznych — nie udaje realnego wyjątku jak TRANSCRIBE
    expect(entry!.exceptionReason).toMatch(/syntetyczn/i)
    expect(entry!.transferMechanism).toMatch(/BRAK/)
  })

  it('istniejący wpis GROQ (TRANSCRIBE) pozostaje bez zmian @REQ: INFRA-GROQ-DEMO-INTERIM', () => {
    const entry = PROVIDERS.find((p: any) => p.id === 'GROQ')
    expect(entry?.kind).toBe('TRANSCRIPTION')
    expect(entry?.exceptionApprovedBy).toBe('Michal, 2026-08-27')
  })
})
