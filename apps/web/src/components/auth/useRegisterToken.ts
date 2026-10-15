import { useState, useEffect } from 'react'

export type UIState = 'LOADING' | 'ERROR' | 'FORM' | 'SUCCESS'

export function useRegisterToken(token: string | null) {
  const [uiState, setUiState] = useState<UIState>('LOADING')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [errorStatus, setErrorStatus] = useState<string>('')
  const [maskedEmail, setMaskedEmail] = useState<string>('')
  const [role, setRole] = useState<'family' | 'legal_guardian' | string>('family')

  useEffect(() => {
    if (!token) {
      void Promise.resolve().then(() => {
        setErrorStatus('MISSING_TOKEN')
        setErrorMessage('Brak tokena rejestracji. Upewnij się, że używasz linku przesłanego w wiadomości e-mail.')
        setUiState('ERROR')
      })
      return
    }

    let isMounted = true

    async function checkToken() {
      try {
        setUiState('LOADING')
        const res = await fetch(`/api/family/invite/validate?token=${encodeURIComponent(token!)}`)
        const data = await res.json()

        if (!isMounted) return

        if (res.ok && data.valid) {
          setMaskedEmail(data.maskedEmail || '')
          setRole(data.role || 'family')
          setUiState('FORM')
        } else {
          setErrorStatus(data.status || 'INVALID')
          setErrorMessage(data.message || 'To zaproszenie jest nieprawidłowe lub straciło ważność.')
          setUiState('ERROR')
        }
      } catch {
        if (!isMounted) return
        setErrorStatus('NETWORK_ERROR')
        setErrorMessage('Nie udało się nawiązać połączenia w celu weryfikacji zaproszenia.')
        setUiState('ERROR')
      }
    }

    checkToken()

    return () => {
      isMounted = false
    }
  }, [token])

  return { uiState, setUiState, errorMessage, errorStatus, maskedEmail, role }
}
