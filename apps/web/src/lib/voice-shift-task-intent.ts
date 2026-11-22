type TaskIntent = { title: string; quote: string }

const sentence = new Intl.Segmenter('pl', { granularity: 'sentence' })
const nextShift = /^(?:na następną zmianę|next shift|на наступну зміну)\s*[:–—-]\s*|^na następnej zmianie\s+(?:trzeba|proszę|należy)\s+/iu
const noTask = /^(?:brak\s+zadań|nic\b|nie ma\b|nothing\b|no tasks\b|none\b|завдань немає)/iu

export function extractNextShiftTaskIntents(sanitizedText: string): TaskIntent[] {
  const matching = new Map<string, TaskIntent>()
  for (const { segment } of sentence.segment(sanitizedText)) {
    const quote = segment.trim()
    if (!nextShift.test(quote) || quote.length > 420) continue
    const title = quote.replace(nextShift, '').replace(/[.!?;]+$/u, '').trim()
    if (!title || title.length > 300 || noTask.test(title)) continue
    matching.set(title.toLocaleLowerCase('pl'), { title, quote })
    if (matching.size === 6) break
  }
  return [...matching.values()]
}
