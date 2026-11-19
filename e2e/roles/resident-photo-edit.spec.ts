import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';
import postgres from 'postgres';

/**
 * @REQ: ADM-RESIDENT-PHOTO
 *
 * SC-ADM-25/AC4: kierownik placówki dodaje zdjęcie podopiecznego w oknie „Edytuj”; plik trafia do prywatnego
 * bucketu resident-photos w folderze <placówka>/<podopieczny>, a residents.photo_path wskazuje ten plik.
 */
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
// Najmniejszy poprawny PNG (1×1 px)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('Zdjęcie podopiecznego w oknie „Edytuj” (@REQ: ADM-RESIDENT-PHOTO)', () => {
  test('@REQ: ADM-RESIDENT-PHOTO - kierownik dodaje zdjęcie, plik w prywatnym folderze placówki i podopiecznego', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const profile = new ResidentProfilePage(page);
    await profile.openFirstFromList();
    const residentId = page.url().split('/').pop() as string;

    await page.getByTestId('edit-resident-btn').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Zdjęcie podopiecznego').setInputFiles({ name: 'zdjecie.png', mimeType: 'image/png', buffer: PNG });
    await expect(dialog.getByText('Zapisano zdjęcie')).toBeVisible({ timeout: 15000 });

    const sql = postgres(dbUrl!, { prepare: false });
    try {
      const [row] = await sql`SELECT organization_id::text AS org, photo_path FROM public.residents WHERE id = ${residentId}`;
      expect(row.photo_path).toMatch(new RegExp(`^${row.org}/${residentId}/[A-Za-z0-9._-]+\\.(webp|jpe?g|png)$`));
      const [obj] = await sql`SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id = 'resident-photos' AND name = ${row.photo_path}`;
      expect(obj.n).toBe(1);
    } finally {
      await sql.end();
    }

    // SC-ADM-25/AC3: karta pokazuje zdjęcie z prywatnego bucketu przez krótkotrwały podpisany link
    await page.keyboard.press('Escape');
    await page.reload();
    const photo = page.locator('main img').first();
    await expect(photo).toHaveAttribute('src', /\/storage\/v1\/object\/sign\/resident-photos\//);
    expect(await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

    // Lista podopiecznych kierownika też pokazuje zdjęcie z podpisanego linku
    await page.goto('/admin/residents');
    const rowPhoto = page.locator(`main a[href$="/admin/residents/${residentId}"]`).first().locator('xpath=ancestor::tr').locator('img').first();
    await expect(rowPhoto).toHaveAttribute('src', /\/storage\/v1\/object\/sign\/resident-photos\//);

    // Tablica dyżuru pielęgniarki tej placówki pokazuje to samo zdjęcie (odczyt personelu z RLS storage)
    await page.context().clearCookies();
    await loginPage.loginAs('nurse');
    await page.goto('/staff');
    // Zdjęcia są w widokach kafelkowych tablicy (tabela ich nie pokazuje)
    await page.locator('[data-slot="view-toggle"]:visible button[aria-label="Widok szybkiego obchodu"]').click();
    await expect(page.locator(`main img[src*="/storage/v1/object/sign/resident-photos/"][src*="${residentId}"]`).first()).toBeVisible();

    // Portal rodziny: powiązany bliski widzi zdjęcie w nagłówku (RPC zwraca photo_path, portal podpisuje link)
    await page.context().clearCookies();
    await loginPage.loginAs('family');
    await page.context().addCookies([{ name: 'family_resident_id', value: residentId, url: page.url() }]);
    await page.goto('/dashboard');
    await expect(page.locator(`header img[src*="/storage/v1/object/sign/resident-photos/"][src*="${residentId}"]`).first()).toBeAttached();
  });
});
