interface RegisterConsentsSectionProps {
  acceptTerms: boolean
  setAcceptTerms: (val: boolean) => void
  acceptDataProcessing: boolean
  setAcceptDataProcessing: (val: boolean) => void
  isGuardian: boolean
  disabled: boolean
}

export function RegisterConsentsSection({
  acceptTerms,
  setAcceptTerms,
  acceptDataProcessing,
  setAcceptDataProcessing,
  isGuardian,
  disabled,
}: RegisterConsentsSectionProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3 bg-surface-sunken">
      <p className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
        Wymagane oświadczenia
      </p>
      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
          disabled={disabled}
        />
        <span className="text-sm text-foreground leading-relaxed">
          Akceptuję regulamin korzystania z platformy Silver Care oraz zasady ochrony prywatności.
        </span>
      </label>

      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acceptDataProcessing}
          onChange={(e) => setAcceptDataProcessing(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
          disabled={disabled}
        />
        <span className="text-sm text-foreground leading-relaxed">
          {isGuardian ? (
            <>
              Oświadczam, że jestem opiekunem prawnym pensjonariusza i wyrażam zgodę na przetwarzanie danych niezbędnych do opieki i generowania raportów dziennych (zgodnie z Art. 9 RODO).
            </>
          ) : (
            <>
              Wyrażam zgodę na otrzymywanie podsumowań i raportów o pobycie mojego bliskiego w placówce.
            </>
          )}
        </span>
      </label>
    </div>
  )
}
