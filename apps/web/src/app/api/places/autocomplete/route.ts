import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * @REQ: ORG-PROVISION
 * @REQ: SEC-SESSION
 *
 * Proxy endpoint dla Google Places Autocomplete API.
 * Umożliwia bezpieczne i niezawodne wyszukiwanie adresów placówek
 * w modalach tworzenia i edycji organizacji, eliminując zależność
 * od ładowania zewnętrznych skryptów w przeglądarce i blokad reklam.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const input = searchParams.get('input')?.trim()

    if (!input || input.length < 3) {
      return NextResponse.json({ predictions: [] })
    }

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        predictions: [],
        warning: 'Google Maps API key not configured'
      })
    }

    const googlePlacesUrl = new URL(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json'
    )
    googlePlacesUrl.searchParams.set('input', input)
    googlePlacesUrl.searchParams.set('types', 'address')
    googlePlacesUrl.searchParams.set('components', 'country:pl')
    googlePlacesUrl.searchParams.set('language', 'pl')
    googlePlacesUrl.searchParams.set('key', apiKey)

    const response = await fetch(googlePlacesUrl.toString(), {
      next: { revalidate: 3600 } // Cache dla identycznych zapytań
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Błąd komunikacji z Google Places API' },
        { status: 502 }
      )
    }

    const data = await response.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[Places API] Google response status:', data.status, data.error_message)
      return NextResponse.json({ predictions: [] })
    }

    const predictions = (data.predictions || []).map((p: any) => ({
      place_id: p.place_id,
      description: p.description,
      main_text: p.structured_formatting?.main_text || p.description,
      secondary_text: p.structured_formatting?.secondary_text || ''
    }))

    return NextResponse.json({ predictions })
  } catch (error) {
    console.error('[Places API] Internal error:', error)
    return NextResponse.json(
      { error: 'Wystąpił nieoczekiwany błąd podczas autouzupełniania adresu' },
      { status: 500 }
    )
  }
}
