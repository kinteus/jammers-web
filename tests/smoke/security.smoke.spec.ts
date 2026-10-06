import { expect, test } from "@playwright/test";

// These checks do not create sessions, submit login payloads, or write application data.
test("CSP uses fresh nonces, hydrates the page and blocks injected inline scripts", async ({ page, request }) => {
  const response = await page.goto("/profile");
  const csp = response?.headers()["content-security-policy"] ?? "";
  const scripts = csp.split(";").find((part) => part.trim().startsWith("script-src ")) ?? "";
  expect(scripts).toContain("'nonce-");
  expect(scripts).not.toContain("'unsafe-inline'");
  expect(scripts).not.toContain("'unsafe-eval'");
  expect(csp).not.toMatch(/connect-src[^;]* (?:ws:|wss:)(?: |;)/);
  const second = await request.get("/profile");
  expect(second.headers()["content-security-policy"]).not.toBe(csp);
  await expect(page.locator("body")).not.toBeEmpty();
  const result = await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "document.documentElement.dataset.xssExecuted = 'yes'";
    document.body.appendChild(script);
    return document.documentElement.dataset.xssExecuted;
  });
  expect(result).toBeUndefined();
  const nonces = await page.locator("script[src*='/_next/']").evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).nonce));
  expect(nonces.length).toBeGreaterThan(0);
  expect(nonces.every((nonce) => nonce && csp.includes(`'nonce-${nonce}'`))).toBe(true);
});

test("admin data remains unavailable with a middleware bypass header", async ({ request }) => {
  const response = await request.get("/admin", { headers: { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" } });
  const html = await response.text();
  expect(html).not.toContain('name="registrationClosesAt"');
  expect(html).not.toContain('name="telegramUsername"');
});
