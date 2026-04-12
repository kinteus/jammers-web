import { expect, test, type Page } from "@playwright/test";

async function signInLocally(page: Page, username: string, role: "USER" | "ADMIN") {
  await page.goto("/profile");
  await page.getByLabel(/Telegram username|Telegram-ник/i).fill(username);
  await page.getByLabel(/Role|Роль/i).selectOption(role);
  await page.getByRole("button", { name: /Continue locally|Продолжить локально/i }).click();
  await expect(page.getByRole("heading", { name: /Your current activity|Твоя текущая активность/i })).toBeVisible();
}

test.describe("Jammers smoke", () => {
  test("public pages render and nearest gig opens", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Right now|Прямо сейчас/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Released setlists|Опубликованные сетлисты/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Сцена в цифрах|Scene in numbers/i })).toBeVisible();

    await page.getByRole("link", { name: /Open next gig board|Открыть борд ближайшего гига/i }).click();
    await expect(page).toHaveURL(/\/events\/[a-z0-9]+/i);
    await expect(page.locator("main")).toContainText(/FAQ|Борд|Gig|Гиг/i);

    await page.goto("/faq");
    await expect(page.getByRole("heading", { name: /How The Jammers works|Как всё устроено у The Jammers/i })).toBeVisible();
  });

  test("user can sign in locally and join then release a seat", async ({ page }) => {
    await signInLocally(page, "smoke_user", "USER");

    await page.goto("/events/spring-jam-night");
    const joinButton = page.getByRole("button", { name: /^Join$/ }).first();
    await expect(joinButton).toBeVisible();
    await joinButton.click();

    await expect(page.getByText(/Seat claimed|Место занято/i)).toBeVisible();

    const releaseButton = page.getByRole("button", { name: /Release .*|Освободить /i }).first();
    await expect(releaseButton).toBeVisible();
    await releaseButton.click();

    await expect(page.getByText(/Seat released|Место освобождено/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Join$/ }).first()).toBeVisible();
  });

  test("admin can sign in locally and open the admin cockpit", async ({ page }) => {
    await signInLocally(page, "kinteus", "ADMIN");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Open only the tool you need/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create gig/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open event admin/i }).first()).toBeVisible();
  });
});
