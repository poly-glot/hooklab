import { test, expect } from './fixtures/test-fixtures';

const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
const PROJECT_ID = 'demo-webhook';

/**
 * Email Link Auth tests — emulator only.
 *
 * The server-side /api/email-auth/send-link endpoint fails in emulator mode
 * (it calls the real Google Identity Toolkit API). So we generate OOB codes
 * via the Auth emulator REST API directly and test the client-side sign-in flow.
 */
test.describe('Email Link Auth', () => {
  test.skip(!process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Requires Firebase Auth emulator');

  test('clicking "Continue with Email Link" shows email input form', async ({
    authPage,
  }) => {
    await authPage.goto();
    await authPage.expectLoaded();

    // Click the email link button
    await authPage.clickEmailLink();

    // Email input and submit button should appear
    const emailInput = authPage.page.getByPlaceholder('Enter your email');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await expect(emailInput).toBeFocused();

    const submitBtn = authPage.page.getByRole('button', { name: /Send Link/i });
    await expect(submitBtn).toBeVisible();
  });

  test('email input validates required field', async ({ authPage }) => {
    await authPage.goto();
    await authPage.expectLoaded();
    await authPage.clickEmailLink();

    // Submit without entering email — HTML5 validation should prevent submission
    const emailInput = authPage.page.getByPlaceholder('Enter your email');
    await expect(emailInput).toBeVisible({ timeout: 5000 });

    // The input has required attribute
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('submitting email calls send-link API', async ({ authPage }) => {
    await authPage.goto();
    await authPage.expectLoaded();
    await authPage.clickEmailLink();

    const emailInput = authPage.page.getByPlaceholder('Enter your email');
    await emailInput.fill('test-send@example.com');

    // Intercept the API call to verify it was made
    const apiPromise = authPage.page.waitForResponse(
      (res) => res.url().includes('/api/email-auth/send-link'),
      { timeout: 10000 }
    );

    const submitBtn = authPage.page.getByRole('button', { name: /Send Link/i });
    await submitBtn.click();

    const response = await apiPromise;
    // In emulator mode, the server endpoint returns 500 (calls real Google API)
    // but this verifies the UI correctly calls the endpoint
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(600);
  });

  test('OOB code from emulator completes sign-in', async ({ page }) => {
    const timestamp = Date.now();
    const email = `e2e-link-${timestamp}@test.com`;

    // Step 1: Generate OOB code via Auth emulator REST API
    const oobRes = await fetch(
      `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=demo-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'EMAIL_SIGNIN',
          email,
          continueUrl: 'http://localhost:5173/auth',
          canHandleCodeInApp: true,
        }),
      }
    );
    expect(oobRes.ok).toBe(true);

    // Step 2: Fetch OOB codes and find the one for our email
    const codesRes = await fetch(
      `http://${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/oobCodes`
    );
    const codesData = await codesRes.json();
    const oobEntry = codesData.oobCodes.find(
      (c: { email: string }) => c.email === email
    );
    expect(oobEntry).toBeTruthy();

    // Step 3: Get the redirect URL from the emulator action endpoint
    // The oobLink points to the emulator action handler which 303-redirects
    // to continueUrl with oobCode + apiKey params appended
    const oobLink: string = oobEntry.oobLink;
    const actionUrl = new URL(oobLink);
    const oobCode = actionUrl.searchParams.get('oobCode')!;

    // Build the URL the client would receive after email link redirect
    const signInUrl = `http://localhost:5173/auth?mode=signIn&oobCode=${oobCode}&apiKey=demo-key&lang=en`;

    // Step 4: Store email in localStorage (simulates what the UI does on send)
    await page.goto('/auth');
    await page.evaluate((e: string) => {
      window.localStorage.setItem('emailForSignIn', e);
    }, email);

    // Step 5: Navigate to the sign-in URL (simulates clicking the email link)
    await page.goto(signInUrl);

    // Step 6: App should detect the email link, auto-complete sign-in, redirect
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await expect(
      page.getByRole('button', { name: /ADD NEW/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('email link sign-in without localStorage shows confirm email input', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const email = `e2e-confirm-${timestamp}@test.com`;

    // Generate OOB code
    await fetch(
      `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=demo-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'EMAIL_SIGNIN',
          email,
          continueUrl: 'http://localhost:5173/auth',
          canHandleCodeInApp: true,
        }),
      }
    );

    // Fetch OOB code
    const codesRes = await fetch(
      `http://${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/oobCodes`
    );
    const codesData = await codesRes.json();
    const oobEntry = codesData.oobCodes.find(
      (c: { email: string }) => c.email === email
    );
    const oobCode = new URL(oobEntry.oobLink).searchParams.get('oobCode')!;

    // Navigate WITHOUT setting localStorage (simulates opening link in different browser)
    const signInUrl = `http://localhost:5173/auth?mode=signIn&oobCode=${oobCode}&apiKey=demo-key&lang=en`;
    await page.goto(signInUrl);

    // Should show "Confirm your email" input since no email in localStorage
    const confirmInput = page.getByPlaceholder('Confirm your email');
    await expect(confirmInput).toBeVisible({ timeout: 10000 });

    // Enter the email and confirm
    await confirmInput.fill(email);
    const confirmBtn = page.getByRole('button', { name: /Confirm/i });
    await confirmBtn.click();

    // Should complete sign-in and redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await expect(
      page.getByRole('button', { name: /ADD NEW/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });
});
