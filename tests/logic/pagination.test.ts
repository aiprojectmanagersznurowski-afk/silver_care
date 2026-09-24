import { describe, it, expect } from 'vitest'
import {
  parsePaginationParams,
  getPaginationRange,
  buildPaginationMeta,
} from '../../apps/web/src/lib/pagination'

describe('Server Pagination Logic (@REQ: ADM-RESIDENT-ADD, @REQ: SEC-AUDIT-APPEND-ONLY)', () => {
  it('correctly parses default and custom query parameters @REQ: ADM-RESIDENT-ADD', () => {
    const emptyParams = new URLSearchParams()
    const def = parsePaginationParams(emptyParams, 25, 100)
    expect(def.page).toBe(1)
    expect(def.limit).toBe(25)

    const customParams = new URLSearchParams('page=3&limit=50')
    const custom = parsePaginationParams(customParams, 20, 100)
    expect(custom.page).toBe(3)
    expect(custom.limit).toBe(50)

    // Caps at maxLimit
    const overLimit = new URLSearchParams('page=-2&limit=999')
    const sanitized = parsePaginationParams(overLimit, 20, 100)
    expect(sanitized.page).toBe(1)
    expect(sanitized.limit).toBe(100)
  })

  it('calculates accurate SQL range offsets (from, to) @REQ: ADM-RESIDENT-ADD', () => {
    const p1 = getPaginationRange({ page: 1, limit: 20 })
    expect(p1.from).toBe(0)
    expect(p1.to).toBe(19)

    const p2 = getPaginationRange({ page: 2, limit: 20 })
    expect(p2.from).toBe(20)
    expect(p2.to).toBe(39)

    const p5 = getPaginationRange({ page: 5, limit: 10 })
    expect(p5.from).toBe(40)
    expect(p5.to).toBe(49)
  })

  it('builds comprehensive pagination metadata with navigation flags @REQ: SEC-AUDIT-APPEND-ONLY', () => {
    // 55 items, limit 20 -> 3 pages
    const metaPage1 = buildPaginationMeta(55, { page: 1, limit: 20 })
    expect(metaPage1.totalPages).toBe(3)
    expect(metaPage1.hasNextPage).toBe(true)
    expect(metaPage1.hasPrevPage).toBe(false)

    const metaPage2 = buildPaginationMeta(55, { page: 2, limit: 20 })
    expect(metaPage2.hasNextPage).toBe(true)
    expect(metaPage2.hasPrevPage).toBe(true)

    const metaPage3 = buildPaginationMeta(55, { page: 3, limit: 20 })
    expect(metaPage3.hasNextPage).toBe(false)
    expect(metaPage3.hasPrevPage).toBe(true)

    // 0 items
    const metaZero = buildPaginationMeta(0, { page: 1, limit: 20 })
    expect(metaZero.totalPages).toBe(1)
    expect(metaZero.hasNextPage).toBe(false)
    expect(metaZero.hasPrevPage).toBe(false)
  })
})
