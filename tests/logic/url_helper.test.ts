import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getRequestOrigin, getRedirectUrl } from '../../apps/web/src/lib/url-helper'

describe('URL Helper and Domain Origin Standardization', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  afterEach(() => {
    if (originalEnv) {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv
    } else {
      delete process.env.NEXT_PUBLIC_SITE_URL
    }
  })

  it('preserves custom domain from x-forwarded-host header @REQ: SEC-SESSION', () => {
    const request = new Request('https://silver-care-six.vercel.app/auth/signout', {
      headers: {
        'x-forwarded-host': 'silvercase.space',
        'x-forwarded-proto': 'https'
      }
    })

    const origin = getRequestOrigin(request)
    expect(origin).toBe('https://silvercase.space')

    const redirectUrl = getRedirectUrl('/login', request)
    expect(redirectUrl.toString()).toBe('https://silvercase.space/login')
  })

  it('preserves localhost during local development @REQ: SEC-SESSION', () => {
    const request = new Request('http://localhost:3000/auth/signout', {
      headers: {
        host: 'localhost:3000'
      }
    })

    const origin = getRequestOrigin(request)
    expect(origin).toBe('http://localhost:3000')

    const redirectUrl = getRedirectUrl('/login', request)
    expect(redirectUrl.toString()).toBe('http://localhost:3000/login')
  })

  it('redirects to silvercase.space instead of vercel.app when request arrives on vercel domain @REQ: SEC-SESSION', () => {
    const request = new Request('https://silver-care-six.vercel.app/auth/signout', {
      headers: {
        host: 'silver-care-six.vercel.app',
        'x-forwarded-proto': 'https'
      }
    })

    const origin = getRequestOrigin(request)
    expect(origin).toBe('https://silvercase.space')

    const redirectUrl = getRedirectUrl('/login', request)
    expect(redirectUrl.toString()).toBe('https://silvercase.space/login')
  })

  it('respects NEXT_PUBLIC_SITE_URL environment variable when set @REQ: SEC-SESSION', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom-care.space/'

    const request = new Request('https://silver-care-six.vercel.app/auth/signout', {
      headers: {
        host: 'silver-care-six.vercel.app'
      }
    })

    const origin = getRequestOrigin(request)
    expect(origin).toBe('https://custom-care.space')

    const redirectUrl = getRedirectUrl('/login', request)
    expect(redirectUrl.toString()).toBe('https://custom-care.space/login')
  })
})
