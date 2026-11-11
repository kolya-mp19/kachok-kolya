import { chromium } from 'playwright';

export async function launchBrowser() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

  return chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
}
