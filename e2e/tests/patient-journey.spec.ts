import { test, expect, type Page } from "@playwright/test";

// A unique patient per run so re-runs never collide on email / national ID.
// NB: the password must NOT contain any 3+ char part of the name or the email
// local part (backend policy), hence a name/email/password with no overlap.
const stamp = Date.now();
const patient = {
  name: "Test User",
  email: `e2e-${stamp}@example.com`,
  password: "Str0ngPass9",
  phone: "+15550100",
  dateOfBirth: "1990-05-15",
  nationalId: `E2E${stamp}`,
};

test.describe.configure({ mode: "serial" });

test.describe("Patient journey: register → book → cancel", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("registers a new patient", async () => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill(patient.name);
    await page.getByLabel("Email").fill(patient.email);
    await page.getByLabel("Password").fill(patient.password);
    await page.getByLabel("Phone number").fill(patient.phone);
    await page.getByLabel("Date of birth").fill(patient.dateOfBirth);
    await page.getByLabel("National ID").fill(patient.nationalId);
    await page.getByRole("button", { name: /create account/i }).click();
    // On success the app redirects to the sign-in page.
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test("signs in", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(patient.email);
    await page.getByLabel("Password").fill(patient.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/patient/, { timeout: 20_000 });
  });

  test("books an appointment with an available doctor", async () => {
    await page.goto("/patient/doctors");
    await expect(page.getByText(/doctors? found|No matches/i)).toBeVisible({ timeout: 20_000 });

    const doctorCount = await page.getByRole("heading", { level: 3 }).count();
    let booked = false;

    // Walk the doctor list until we find one with a bookable future slot.
    for (let i = 0; i < doctorCount; i++) {
      await page.goto("/patient/doctors");
      await expect(page.getByText(/doctors? found/i)).toBeVisible({ timeout: 20_000 });
      await page.getByRole("heading", { level: 3 }).nth(i).click();
      await expect(page.getByRole("heading", { name: "Available Times" })).toBeVisible({
        timeout: 20_000,
      });

      const slots = page.locator("button").filter({ hasText: /\d{1,2}:\d{2}\s?(AM|PM)/i });
      if ((await slots.count()) > 0) {
        await slots.first().click();
        await page.getByRole("button", { name: "Confirm Appointment" }).click();
        await expect(page.getByText(/Appointment Confirmed/i)).toBeVisible({ timeout: 20_000 });
        booked = true;
        break;
      }
    }

    expect(booked, "expected a seeded doctor with an available future slot").toBe(true);
  });

  test("cancels the booked appointment", async () => {
    await page.goto("/patient/appointments");

    const cancelBtn = page.getByRole("button", { name: /cancel appointment/i });
    await expect(cancelBtn.first()).toBeVisible({ timeout: 20_000 });

    // Cancellation goes through window.confirm — auto-accept it.
    page.once("dialog", (dialog) => dialog.accept());
    await cancelBtn.first().click();

    // The freshly-registered patient had exactly one appointment, so the
    // "upcoming" tab should have no cancel buttons left.
    await expect(page.getByRole("button", { name: /cancel appointment/i })).toHaveCount(0, {
      timeout: 20_000,
    });
  });
});
