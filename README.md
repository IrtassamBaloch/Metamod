# Metamod Test Automation

A robust, scalable Playwright + JavaScript test automation framework for **Metamod** — following industry best practices defined in [`skills/SKILL.md`](./skills/SKILL.md).

---

## 📁 Project Structure

```
Metamod Test Automation/
├── tests/                  # Test specs
│   └── login.spec.js       # Login test suite (@smoke @login)
├── pages/                  # Page Object Model (POM) classes
│   └── LoginPage.js
├── fixtures/               # Shared Playwright fixtures
│   ├── auth.js             # Worker-scoped authenticated session fixture
│   ├── pages.js            # Shared page object fixtures
│   └── refinement.js       # OpenAI refinement fixture
├── utils/                  # Utility helpers
│   └── env.js              # Safe env variable reader
├── config/                 # Environment configuration
│   ├── environments.js     # URL map per environment
│   └── playwright.js       # Shared Playwright test config
├── skills/                 # Automation best practices
│   └── SKILL.md
├── .env                    # ⚠️ Local secrets — NOT committed to git
├── .env.example            # Template for .env (safe to commit)
├── .mcp.json               # MCP server configuration
├── playwright.config.js    # Playwright configuration
├── .gitignore
└── README.md
```

---

## ⚙️ Setup

### 1. Install Dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```env
BASE_URL=https://staging.metamod.ai
METAMOD_USERNAME=your_username
METAMOD_PASSWORD=your_password
```

- Prefer `METAMOD_USERNAME` instead of plain `USERNAME`. On Windows, `USERNAME` is usually already defined by the OS and can override your Metamod login unexpectedly.
- Legacy aliases `NAME` and `PASSWORD` are still supported.

---

## 🚀 Running Tests

### Run all tests
```bash
npx playwright test
```

### Run the main suites
```bash
npm run test:login
npm run test:metamod
npm run test:refinement
```

### Run login tests only
```bash
npx playwright test tests/login.spec.js
```

### Run smoke tests
```bash
npx playwright test --grep @smoke
```

### Run with browser visible (headed mode)
```bash
npx playwright test --headed
```

### Run with UI mode
```bash
npx playwright test --ui
```

---

## 📊 Reports

Open the HTML report after a test run:
```bash
npx playwright show-report
```

In CI, Playwright also emits a JUnit file at `test-results/junit.xml` so Azure DevOps can publish native test runs.

---

## 🌍 Environment Switching

Switch environments by overriding `BASE_URL`:

```bash
BASE_URL=https://qa.metamod.ai npx playwright test
```

| Environment | URL                                  |
|-------------|--------------------------------------|
| Staging     | `https://staging.metamod.ai`         |
| QA          | `https://qa.metamod.ai`              |
| Production  | `https://metamod.ai`                 |

---

## 🤖 MCP Servers

This project is configured with two MCP servers in `.mcp.json`:

| Server     | Package                                  | Purpose                          |
|------------|------------------------------------------|----------------------------------|
| Playwright | `@playwright/mcp`                        | Browser automation via MCP tools |
| Git        | `@modelcontextprotocol/server-git`       | Git operations via MCP tools     |

---

## 🧪 Test Cases

| ID      | Description                                     | Tag            |
|---------|-------------------------------------------------|----------------|
| TC-001  | Successful login with valid credentials         | @smoke @login  |
| TC-002  | Login page renders all expected form elements   | @smoke @login  |
| TC-003  | Invalid credentials show an error message       | @login         |

---

## 📐 Best Practices

See [`skills/SKILL.md`](./skills/SKILL.md) for the full guide on:
- Page Object Model (POM)
- Playwright Locators
- Fixtures & parallel execution
- CI/CD integration (Azure DevOps)
- Environment-based configuration
- HTML reporting & traces

---

## 🔒 Security

- `.env` is listed in `.gitignore` and **must never be committed**
- Use CI/CD secret variables for credentials in pipelines

---

## Azure DevOps CI

This repository now includes [`azure-pipelines.yml`](./azure-pipelines.yml) for Playwright CI on `ubuntu-latest`.

### Pipeline flow

The pipeline is organized as a single clear stage:

1. Checkout the repository
2. Install Node.js and npm dependencies
3. Install Playwright Chromium and Linux dependencies
4. Run the configured Playwright command
5. Publish JUnit results, HTML report, and raw test artifacts

### Required pipeline variables

Configure these in Azure DevOps before running the pipeline:

- `METAMOD_USERNAME` (secret)
- `METAMOD_PASSWORD` (secret)

### Optional pipeline variables

- `TEST_ENV` = `staging`, `qa`, `dev`, or `production`
- `BASE_URL` to override `TEST_ENV` with a custom URL
- `PLAYWRIGHT_TEST_COMMAND` to target a subset of tests or a specific suite
- `OPENAI_API_KEY` (secret) when `PLAYWRIGHT_TEST_COMMAND` includes the refinement loop suite
- `OPENAI_MODEL` if you want to override the default OpenAI model

### Variable mapping inside the pipeline

- `TEST_ENV` and `BASE_URL` control the target environment
- `PLAYWRIGHT_TEST_COMMAND` controls the exact Playwright command to run
- `METAMOD_USERNAME`, `METAMOD_PASSWORD`, `OPENAI_API_KEY`, and `OPENAI_MODEL` are passed directly to the test process

### Example test command overrides

Run only the login and main flow suites:

```text
PLAYWRIGHT_TEST_COMMAND=npx playwright test tests/login.spec.js tests/metamod.spec.js
```

Run only smoke coverage:

```text
PLAYWRIGHT_TEST_COMMAND=npx playwright test --grep @smoke
```