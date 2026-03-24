---
name: Playwright Automation Best Practices
description: A guide to building robust, maintainable Playwright test automation frameworks following industry best practices.
---

# Playwright Automation Best Practices

Building a robust, maintainable automation framework goes beyond writing tests. Follow these 10 best practices to level up your Playwright framework.

---

## 1️⃣ Design a Clean Project Architecture

Structure your framework clearly for scalability and maintainability:

```
tests/
pages/       ← POM classes
utils/
fixtures/
config/
```

> A good structure keeps your framework scalable and maintainable.

---

## 2️⃣ Implement Page Object Model (POM)

Encapsulate page logic into reusable classes.

- ✔ Improves readability
- ✔ Reduces duplication
- ✔ Enhances maintainability

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async login(username: string, password: string) {
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }
}
```

---

## 3️⃣ Use Playwright Locators (Not Raw Selectors)

Prefer semantic, role-based locators over raw CSS/XPath selectors.

```typescript
// ✅ Preferred
await page.getByRole('button', { name: 'Login' }).click();
await page.getByLabel('Email').fill('user@example.com');

// ❌ Avoid
await page.click('#btn-login');
await page.fill('input[type="email"]', 'user@example.com');
```

**Benefits:**
- ✔ Built-in auto-wait
- ✔ More stable tests
- ✔ Better reliability

---

## 4️⃣ Avoid Hard Waits

Never rely on `waitForTimeout()`. Use Playwright's built-in auto-waiting and assertions instead.

```typescript
// ❌ Avoid
await page.waitForTimeout(3000);

// ✅ Use auto-waiting assertions
await expect(page.getByText('Welcome')).toBeVisible();
await page.waitForSelector('.dashboard');
```

> Smart waits = Stable tests.

---

## 5️⃣ Leverage Fixtures

Use fixtures for shared setup and teardown logic:

- **Authentication setup** — log in once, reuse across tests
- **Test data management** — inject dynamic test data
- **Browser context reuse** — isolate state per test suite

```typescript
// fixtures/auth.ts
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill(process.env.USERNAME!);
    await page.getByLabel('Password').fill(process.env.PASSWORD!);
    await page.getByRole('button', { name: 'Login' }).click();
    await use(page);
  },
});
```

---

## 6️⃣ Run Tests in Parallel

Configure workers in `playwright.config.ts` for faster CI execution:

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 4 : 2,
  fullyParallel: true,
});
```

- ✔ Reduced execution time
- ✔ CI/CD optimized

---

## 7️⃣ Capture Screenshots & Traces

Enable trace and screenshot capture on failure or retry for easier debugging:

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
});
```

> When tests fail — your logs should tell the story.

---

## 8️⃣ Integrate with CI/CD

Automate test execution in your CI/CD pipeline:

**Azure DevOps:**
```yaml
- script: npx playwright test
  displayName: 'Run Playwright Tests'
  env:
    BASE_URL: $(BASE_URL)
    USERNAME: $(USERNAME)
    PASSWORD: $(PASSWORD)
```

> Automation without CI/CD = Missed opportunity.

---

## 9️⃣ Use Environment-Based Configuration

Manage configs per environment using `.env` files or `playwright.config.ts`:

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL ?? 'https://qa.example.com',
  },
});
```

Supported environments:
| Environment | Base URL                      |
|-------------|-------------------------------|
| Dev         | `https://dev.example.com`     |
| QA          | `https://qa.example.com`      |
| Staging     | `https://staging.example.com` |
| Production  | `https://example.com`         |

> Keep configs flexible and environment-driven.

---

## 🔟 Generate Detailed HTML Reports

Use Playwright's built-in HTML reporter for visibility and insights:

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'on-failure' }],
    ['list'],
  ],
});
```

Run and open the report:
```bash
npx playwright show-report
```

---

## 💡 Pro Tips

- Use **Playwright Test Runner** for retries, parallel execution, reporting, and built-in assertions.
- Use `expect` soft assertions to continue test execution after a non-critical failure:
  ```typescript
  await expect.soft(page.getByText('Welcome')).toBeVisible();
  ```
- Structure your test tags for selective runs:
  ```bash
  npx playwright test --grep @smoke
  ```
