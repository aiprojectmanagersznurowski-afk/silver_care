import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

// Wrapper component presenting the 4 UI states required by NFR-UI-01 and UI-FOUR-STATES
interface DailyReportPresentationProps {
  state: 'loading' | 'empty' | 'success' | 'error';
  residentName?: string;
  reportDate?: string;
  text?: string;
  steps?: number;
  activeMinutes?: number;
  sleepMinutes?: number;
  errorMessage?: string;
}

function DailyReportPresentation({
  state,
  residentName = 'Jan Kowalski',
  reportDate = '14 sierpnia 2026',
  text = 'Senior spędził spokojny dzień, brał udział w porannych zajęciach plastycznych i spacerował po ogrodzie.',
  steps = 4250,
  activeMinutes = 45,
  sleepMinutes = 460,
  errorMessage = 'Nie udało się pobrać raportu. Sprawdź połączenie.',
}: DailyReportPresentationProps) {
  if (state === 'loading') {
    return (
      <div className="flex flex-col space-y-4 animate-pulse p-6 border border-border rounded-xl bg-surface max-w-[680px]">
        <div className="h-6 bg-surface-sunken rounded w-1/3"></div>
        <div className="h-4 bg-surface-sunken rounded w-full"></div>
        <div className="h-4 bg-surface-sunken rounded w-2/3"></div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="p-6 bg-surface rounded-xl border border-red-200 text-red-700 max-w-[680px]">
        <p className="font-semibold">Błąd ładowania raportu</p>
        <p className="text-sm mt-1">{errorMessage}</p>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="p-8 text-center text-text-secondary bg-surface-sunken rounded-xl border border-dashed border-border max-w-[680px]">
        <p className="font-medium text-base text-text">Brak opublikowanego raportu</p>
        <p className="text-sm mt-2 text-text-secondary">
          Pierwszy raport dla tego podopiecznego pojawi się po zakończeniu bieżącego dnia i zatwierdzeniu przez personel.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 border border-border rounded-xl bg-surface max-w-[680px] space-y-4">
      <div className="border-b border-border pb-3">
        <h3 className="text-xl font-semibold text-text">Raport dnia — {residentName}</h3>
        <p className="text-sm text-text-tertiary">{reportDate}</p>
      </div>
      <p className="text-[17px] leading-relaxed text-text">{text}</p>
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
        <div>
          <span className="text-xs text-text-tertiary uppercase">Kroki</span>
          <p className="text-lg font-semibold text-text">{steps}</p>
        </div>
        <div>
          <span className="text-xs text-text-tertiary uppercase">Aktywność</span>
          <p className="text-lg font-semibold text-text">{activeMinutes} min</p>
        </div>
        <div>
          <span className="text-xs text-text-tertiary uppercase">Sen</span>
          <p className="text-lg font-semibold text-text">{Math.floor(sleepMinutes / 60)}h {sleepMinutes % 60}m</p>
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof DailyReportPresentation> = {
  title: 'Portal Rodziny/DailyReportViewer (4 Stany)',
  component: DailyReportPresentation,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DailyReportPresentation>;

export const LoadingState: Story = {
  args: {
    state: 'loading',
  },
};

export const EmptyState: Story = {
  args: {
    state: 'empty',
  },
};

export const SuccessState: Story = {
  args: {
    state: 'success',
  },
};

export const ErrorState: Story = {
  args: {
    state: 'error',
  },
};
