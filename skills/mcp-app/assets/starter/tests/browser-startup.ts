import { chromium } from "@playwright/test";
export default async function startup() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  await browser.close();
}
