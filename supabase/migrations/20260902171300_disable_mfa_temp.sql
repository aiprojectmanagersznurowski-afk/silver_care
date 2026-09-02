-- Tymczasowe wyłączenie weryfikacji MFA, ponieważ nie mamy jeszcze UI do jego ustawienia.
-- Blokowało to dostęp personelu (i adminów) do danych chronionych przez RESTRICTIVE policies.

CREATE OR REPLACE FUNCTION public.check_mfa_requirement()
RETURNS boolean AS $$
BEGIN
    RETURN true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
