import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @REQ: ADM-INVITE
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy dla zadania ADM-STAFF-CAREGIVER-VISIBILITY:
 * AC1: Użytkownicy z rolą caregiver pojawiają się w tabeli /admin/staff z etykietą "Opiekun / Opiekunka".
 * AC2: Formularz zapraszania pracownika pozwala wybrać rolę Opiekuna.
 * AC3: Zamknięcie modala po wygenerowaniu zaproszenia nie przeładowuje całej strony (brak window.location.reload).
 * AC4: Komunikat sukcesu z linkiem zaproszenia spełnia normy kontrastu WCAG AA (brak nieczytelnego bg-primary na text-foreground).
 */
describe('Staff Caregiver Visibility & Invitation Dialog (@REQ: ADM-INVITE, @REQ: UI-ACCESSIBILITY)', () => {
  const staffPagePath = path.resolve(process.cwd(), 'apps/web/src/app/(admin)/admin/staff/page.tsx');
  const inviteDialogPath = path.resolve(process.cwd(), 'apps/web/src/components/InviteStaffDialog.tsx');
  const inviteRoutePath = path.resolve(process.cwd(), 'apps/web/src/app/api/staff/invite/route.ts');
  const adminActionsPath = path.resolve(process.cwd(), 'apps/web/src/actions/admin.ts');

  it('includes caregiver in the staff list filter and displays canonical Polish label @REQ: ADM-INVITE', () => {
    const staffPageContent = fs.readFileSync(staffPagePath, 'utf8');

    // Filtr w staff/page.tsx musi uwzględniać rolę 'caregiver'
    expect(staffPageContent).toContain("u.app_metadata?.role === 'caregiver'");
    // Etykieta roli w tabeli
    expect(staffPageContent).toContain('Opiekun / Opiekunka');
  });

  it('allows selecting caregiver role in InviteStaffDialog and API route @REQ: ADM-INVITE', () => {
    const inviteDialogContent = fs.readFileSync(inviteDialogPath, 'utf8');
    const inviteRouteContent = fs.readFileSync(inviteRoutePath, 'utf8');

    // Opcja caregiver w selektorze modala
    expect(inviteDialogContent).toContain('value="caregiver"');
    expect(inviteDialogContent).toContain('Opiekun / Opiekunka');

    // Obsługa w endpointzie API
    expect(inviteRouteContent).toContain("'caregiver'");
  });

  it('does not use window.location.reload and uses smooth router refresh in InviteStaffDialog @REQ: ADM-INVITE', () => {
    const inviteDialogContent = fs.readFileSync(inviteDialogPath, 'utf8');

    // Eliminacja przeładowania strony
    expect(inviteDialogContent).not.toContain('window.location.reload()');
    expect(inviteDialogContent).toContain('router.refresh()');
  });

  it('fixes contrast in invitation success box avoiding unreadable bg-primary @REQ: UI-ACCESSIBILITY', () => {
    const inviteDialogContent = fs.readFileSync(inviteDialogPath, 'utf8');

    // Kasetka sukcesu nie może mieć surowego bg-primary powodującego problem kontrastu z tekstem
    expect(inviteDialogContent).not.toMatch(/className="[^"]*bg-primary[^"]*rounded-md space-y-2/);
  });

  it('allows archiving/deleting staff members with caregiver role @REQ: ADM-INVITE', () => {
    const adminActionsContent = fs.readFileSync(adminActionsPath, 'utf8');

    // deleteStaffAction musi pozwalać na usuwanie/archiwizację roli caregiver
    expect(adminActionsContent).toContain("targetAppMeta.role !== 'caregiver'");
  });
});
