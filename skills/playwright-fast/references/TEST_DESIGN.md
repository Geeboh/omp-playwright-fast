# Test design for fast, maintainable browser QA

1. High-value journey inventory: homepage -> auth -> primary workflow -> save/read -> error/recovery. Small smoke subset tagged `@smoke`.
2. Structure by feature and independent state. Avoid overgrown spec files; Playwright parallelizes files by default.
3. DRY repeated user actions into fixtures/helpers; build page objects only for durable concepts, not each HTML element.
4. Prefer `getByRole`, `getByLabel`, `getByTestId`, and accessible names. Assert user-visible results rather than DOM implementation.
5. Ensure deterministic data using unique suffixes per test/worker. Use API preconditions over slow GUI preparation where valid.
6. For auth storageState keep secrets out of git; ensure parallel tests are read-only if sharing a single account.
7. Test navigation, forms, validation, permissions, error handling, responsive/mobile layouts where applicable.
8. Network: avoid `networkidle` as a general readiness signal. Assert the response/UI state that actually matters.
9. Visual regression: baseline per OS/browser; pin fonts/viewport/locale/timezone, mask truly dynamic fields; never auto-accept changed snapshots.
10. Accessibility: combine semantic locators with dedicated a11y audits when needed; don't claim full WCAG conformance from a smoke run.
11. Measure test durations and common causes of slowness. Separate test overhead from app performance regressions.
12. Smoke, changed, last-failed, quick, matrix are distinct *gates*. Changed/last-failed never replace complete release gates.

## Example fixture

```ts
import { test as base, expect, type Page } from '@playwright/test';
async function openHome(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
}
export const test = base.extend<{ openHome: () => Promise<void> }>({
  openHome: async ({ page }, use) => { await use(() => openHome(page)); },
});
export { expect };
```

## Browser matrix

- Chromium: fastest normal development default; use native Chromium not assume exact branded Chrome parity.
- Firefox: engine-specific CSS/focus/input/scroll checks.
- WebKit: Safari-family compatibility, but actual Safari/device validation may be needed for production-specific issues.

## Failure handling

- Reproduce targeted failure first, inspect trace/log/screenshot, fix cause, rerun targeted Chromium, then regression matrix when risk justifies.
- Never suppress failures with broad timeouts, blanket retries, `.skip()`, or masking unless justified and logged.
