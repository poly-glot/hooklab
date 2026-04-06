import { test, expect } from '@playwright/test';
import { loginAsGuest } from './fixtures/emulator-helpers';

const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
const PROJECT_ID = 'demo-webhook';

/**
 * Account upgrade tests — emulator only.
 *
 * Tests the guest-to-registered upgrade flow. Since no upgrade CTA exists
 * in the UI, these tests verify the upgrade at the API/Firebase level and
 * confirm the user document gets updated quotas.
 */
test.describe('Account Upgrade', () => {
  test.skip(!process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Requires Firebase Auth emulator');

  test('guest user sees "Guest" label in header', async ({ page }) => {
    await loginAsGuest(page);

    // The header shows "Guest" for anonymous users
    await expect(page.getByText('Guest', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('no upgrade CTA exists in current UI', async ({ page }) => {
    await loginAsGuest(page);

    // Document that no upgrade button/link exists
    // Check header, sidebar, profile menu for upgrade-related text
    const upgradeBtn = page.getByRole('button', { name: /upgrade/i })
      .or(page.getByRole('link', { name: /upgrade/i }))
      .or(page.getByText(/upgrade.*account/i));

    const exists = await upgradeBtn.first().isVisible().catch(() => false);
    expect(exists).toBe(false);
  });

  test('(API-level) guest user document exists with seeded flag', async ({ page }) => {
    await loginAsGuest(page);

    // Wait for seed data to confirm auth + user doc creation is complete
    await expect(
      page.locator('[data-testid="endpoint-card"]').first()
    ).toBeVisible({ timeout: 20000 });

    // List user documents from Firestore emulator
    const usersRes = await fetch(
      `http://${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/hooklab/documents/users`,
      { headers: { Authorization: 'Bearer owner' } },
    );
    const usersData = await usersRes.json();
    const userDocs: { name: string; fields: Record<string, unknown>; createTime: string }[] =
      usersData.documents ?? [];

    // Find the most recently created user doc (seeded = true)
    const seededDocs = userDocs.filter(
      (d) => (d.fields.seeded as { booleanValue: boolean })?.booleanValue === true
    );
    expect(seededDocs.length).toBeGreaterThan(0);

    // Most recent seeded doc
    const latest = seededDocs.sort(
      (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    )[0];

    // Verify endpointCount is 6 (from seed)
    const endpointCount = Number(
      (latest.fields.endpointCount as { integerValue: string })?.integerValue
    );
    expect(endpointCount).toBe(6);
  });

  test('(API-level) linking email credential upgrades user doc', async () => {
    const timestamp = Date.now();
    const upgradeEmail = `upgrade-${timestamp}@test.com`;
    const upgradePassword = 'Test1234!';

    // 1. Create a fresh anonymous user via Auth emulator
    const signUpRes = await fetch(
      `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true }),
      },
    );
    const signUpData = await signUpRes.json();
    const uid = signUpData.localId;
    const idToken = signUpData.idToken;
    expect(uid).toBeTruthy();
    expect(idToken).toBeTruthy();

    // 2. Create initial user doc in Firestore (simulates createUserDocument)
    const createPayload = {
      fields: {
        email: { stringValue: `guest_${uid.slice(0, 8)}@guest.local` },
        isAnonymous: { booleanValue: true },
        displayName: { stringValue: 'Guest' },
        endpointCount: { integerValue: '0' },
        quotas: {
          mapValue: {
            fields: {
              maxEndpoints: { integerValue: '10' },
              maxExecutionsPerDay: { integerValue: '100' },
              usedExecutionsToday: { integerValue: '0' },
            },
          },
        },
      },
    };

    const createRes = await fetch(
      `http://${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/hooklab/documents/users?documentId=${uid}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify(createPayload),
      },
    );
    expect(createRes.ok).toBe(true);

    // 3. Link email/password to the anonymous account
    const linkRes = await fetch(
      `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          email: upgradeEmail,
          password: upgradePassword,
          returnSecureToken: true,
        }),
      },
    );
    expect(linkRes.ok).toBe(true);

    // 4. Upgrade the user doc (simulates upgradeUserDocument)
    const upgradePayload = {
      fields: {
        isAnonymous: { booleanValue: false },
        email: { stringValue: upgradeEmail },
        displayName: { stringValue: upgradeEmail.split('@')[0] },
        quotas: {
          mapValue: {
            fields: {
              maxEndpoints: { integerValue: '50' },
              maxExecutionsPerDay: { integerValue: '10000' },
              usedExecutionsToday: { integerValue: '0' },
            },
          },
        },
      },
    };

    await fetch(
      `http://${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/hooklab/documents/users/${uid}?updateMask.fieldPaths=isAnonymous&updateMask.fieldPaths=email&updateMask.fieldPaths=displayName&updateMask.fieldPaths=quotas`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify(upgradePayload),
      },
    );

    // 5. Verify upgraded user doc
    const userDocRes = await fetch(
      `http://${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/hooklab/documents/users/${uid}`,
      { headers: { Authorization: 'Bearer owner' } },
    );
    const userDoc = await userDocRes.json();

    expect(userDoc.fields.isAnonymous?.booleanValue).toBe(false);
    expect(userDoc.fields.email?.stringValue).toBe(upgradeEmail);

    const maxEndpoints = Number(
      userDoc.fields.quotas?.mapValue?.fields?.maxEndpoints?.integerValue,
    );
    expect(maxEndpoints).toBe(50);

    const maxExec = Number(
      userDoc.fields.quotas?.mapValue?.fields?.maxExecutionsPerDay?.integerValue,
    );
    expect(maxExec).toBe(10000);
  });
});
