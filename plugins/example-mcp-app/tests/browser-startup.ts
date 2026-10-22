import { chromium } from '@playwright/test';
export default async function startup() {
  try {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    await browser.close();
  } catch (error) {
    throw new Error(
      `Browser startup blocked. Stop unchanged relaunches; run with approved execution outside the restricted sandbox. Disposable profile only. ${String(error)}`,
    );
  }
}
