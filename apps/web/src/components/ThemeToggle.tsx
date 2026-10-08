'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'labeled';
}

/**
 * Przełącznik trybu ciemnego i jasnego (UI-DARK-MODE-TOGGLE).
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 */
export function ThemeToggle({
  className = '',
  variant = 'icon',
}: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Zapobiega mismatchowi SSR vs Client
    return (
      <button
        type="button"
        disabled
        aria-label="Ładowanie motywu..."
        className={`inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground opacity-70 transition-colors ${className}`}
      >
        <span className="h-5 w-5" />
        {variant === 'labeled' && <span className="ml-2 text-sm">Motyw</span>}
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors ${className}`}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-foreground transition-transform hover:rotate-45" />
      ) : (
        <Moon className="h-5 w-5 text-muted-foreground transition-transform hover:-rotate-12" />
      )}
      {variant === 'labeled' && (
        <span className="ml-2 text-sm font-medium">
          {isDark ? 'Tryb ciemny' : 'Tryb jasny'}
        </span>
      )}
    </button>
  );
}
