import { test, expect } from "@playwright/test";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
let server: ChildProcess;
const passphrase = randomBytes(24).toString("base64url");
test.beforeAll(() => {
  execFileSync(process.execPath, ["scripts/seal.mjs"], {
    env: { ...process.env, SITE_PASSPHRASE: passphrase },
    stdio: "pipe",
  });
  server = spawn(process.execPath, ["scripts/private-test-server.mjs"], {
    stdio: "ignore",
  });
});
test.afterAll(() => server?.kill());
test("private deployment protects assets, unlocks offline app, and locks again without losing save", async ({
  page,
  context,
  request,
}) => {
  await expect
    .poll(async () => {
      try {
        return (await request.get("http://127.0.0.1:4174/")).status();
      } catch {
        return 0;
      }
    })
    .toBe(200);
  const forbidden = await request.get(
    "http://127.0.0.1:4174/assets/original/assets/photos/backgrounds/TOP.jpg",
  );
  expect(forbidden.status()).toBe(404);
  await page.goto("http://127.0.0.1:4174/");
  await expect(
    page.getByRole("heading", { name: "Mrs. English", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("合言葉", { exact: true })
    .fill("a-wrong-test-passphrase");
  await page.getByRole("button", { name: "解除してはじめる" }).click();
  await expect(page.getByRole("status")).toContainText("合言葉が違う", {
    timeout: 30000,
  });
  await page.getByLabel("合言葉", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "解除してはじめる" }).click();
  await expect(page.getByRole("button", { name: /TAP TO START/ })).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole("button", { name: /TAP TO START/ }).click();
  await page
    .getByRole("textbox", { name: "ニックネーム", exact: true })
    .fill("プライベート");
  await page.getByRole("button", { name: "決定", exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /TAP TO START/ }).click();
  await expect(
    page.getByRole("heading", { name: "推しメンバーを選ぼう" }),
  ).toBeVisible();
  await context.setOffline(false);
  // A newly published encrypted version must preserve the old save and caches until verified.
  execFileSync(process.execPath, ["scripts/seal.mjs"], {
    env: { ...process.env, SITE_PASSPHRASE: passphrase },
    stdio: "pipe",
  });
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const changed = new Promise<void>((resolve) =>
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => resolve(),
        { once: true },
      ),
    );
    await reg!.update();
    await changed;
  });
  await page.goto("http://127.0.0.1:4174/?unlock=1");
  await page.getByLabel("合言葉", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "解除してはじめる" }).click();
  await expect(page.getByRole("button", { name: /TAP TO START/ })).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole("button", { name: /TAP TO START/ }).click();
  await expect(
    page.getByRole("heading", { name: "推しメンバーを選ぼう" }),
  ).toBeVisible();
  await page.evaluate(() =>
    navigator.serviceWorker.controller?.postMessage("lock"),
  );
  await expect(page.getByLabel("合言葉", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const keys = await caches.keys();
      return keys.filter(
        (k) => k.startsWith("mrs-private-") && !k.includes("gate"),
      );
    }),
  ).toEqual([]);
  expect(
    (
      await request.get(
        "http://127.0.0.1:4174/assets/original/assets/photos/backgrounds/TOP.jpg",
      )
    ).status(),
  ).toBe(404);
});
