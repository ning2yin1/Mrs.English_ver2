import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
let server: ChildProcess;
test.beforeAll(() => {
  server = spawn(process.execPath, ["scripts/pages-test-server.mjs"], {
    stdio: "ignore",
  });
});
test.afterAll(() => server?.kill());
test("GitHub Pages opens directly without a passphrase, serves assets and restarts offline", async ({
  page,
  context,
  request,
}) => {
  const base = "http://127.0.0.1:4174/Mrs.English_ver2/";
  await expect
    .poll(async () => {
      try {
        return (await request.get(base)).status();
      } catch {
        return 0;
      }
    })
    .toBe(200);
  await page.goto(base);
  await expect(
    page.getByRole("button", { name: /TAP TO START/ }),
  ).toBeVisible();
  expect(await page.locator("input[type=password]").count()).toBe(0);
  expect(
    (
      await request.get(
        base + "assets/original/assets/photos/backgrounds/TOP.jpg",
      )
    ).status(),
  ).toBe(200);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 60000,
    })
    .toBe(true);
  await page.getByRole("button", { name: /TAP TO START/ }).click();
  await page
    .getByRole("textbox", { name: "ニックネーム", exact: true })
    .fill("そのままプレイ");
  await page.getByRole("button", { name: "決定", exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /TAP TO START/ }).click();
  await expect(
    page.getByRole("heading", { name: "推しメンバーを選ぼう" }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const r = await fetch(
        new URL(
          "assets/original/assets/photos/backgrounds/TOP.jpg",
          document.baseURI,
        ),
      );
      return r.status;
    }),
  ).toBe(200);
});
