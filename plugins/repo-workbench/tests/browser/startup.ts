import { chromium } from '@playwright/test';

/** Once per run: a failed macOS startup stops before individual tests retry it. */
export default async function startup() {
  try {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    await browser.close();
  } catch (error) {
    throw new Error(
      `Browser startup is blocked. Stop unchanged relaunches; run this suite with approved execution outside the restricted sandbox. No personal profile is used.\n${String(error)}`,
    );
  }
}
