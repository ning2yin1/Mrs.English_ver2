import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const questions = JSON.parse(
  readFileSync("../questions/questions.json", "utf8"),
);
async function getState(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("mrs-english", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const names = [...db.objectStoreNames];
    const tx = db.transaction(names);
    const result: any = {};
    await Promise.all(
      names.map(async (n) => {
        const st = tx.objectStore(n);
        result[n] = await new Promise((resolve) => {
          const r = st.getAll();
          r.onsuccess = () => resolve(r.result);
        });
      }),
    );
    db.close();
    return result;
  });
}
async function onboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /TAP TO START/ }).click();
  await page
    .getByRole("textbox", { name: "ニックネーム", exact: true })
    .fill("テストプレイヤー");
  await page.getByRole("button", { name: "決定", exact: true }).click();
  await page.getByRole("button", { name: /大森元貴.*Lv/ }).click();
  await page.getByRole("button", { name: "選択を確認" }).click();
  await page.getByRole("button", { name: "決定", exact: true }).click();
  await page.getByRole("button", { name: "この背景に決定" }).click();
  await page.getByRole("button", { name: "開封する", exact: true }).click();
  await page.getByRole("button", { name: "一覧へ", exact: true }).click();
  await page.getByRole("button", { name: "受取済み・ホームへ" }).click();
  await expect(
    page.getByRole("button", { name: /ログイン.*ボーナス/ }),
  ).toBeVisible();
}
async function begin(page: Page, difficulty = "EASY") {
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: /START/ })
    .click();
  await page.getByRole("button", { name: difficulty, exact: true }).click();
  await page
    .locator(".stage-footer")
    .getByRole("button", { name: /START/ })
    .click();
  await page.getByRole("button", { name: "開始する", exact: true }).click();
  await expect(page.locator(".ready")).toHaveCount(0);
  await expect(page.locator(".question")).toBeVisible();
}
async function answerCurrent(page: Page, wrong = false) {
  const st = await getState(page);
  const run = st.runs.find((r: any) => r.status === "active");
  const q = questions.find(
    (q: any) => q.id === run.questionOrder[run.questionIndex],
  );
  if (q.difficulty === "EASY") {
    const option = q.data.options.find((o: any) =>
      wrong ? !o.isCorrect : o.isCorrect,
    );
    await page
      .locator(".options")
      .getByRole("button", { name: option.text, exact: true })
      .click();
  } else {
    for (const id of q.data.correctOrder) {
      const b = q.data.blocks.find((b: any) => b.id === id);
      await page
        .locator(".bank")
        .getByRole("button", { name: b.text, exact: true })
        .first()
        .click();
    }
    await page.getByRole("button", { name: "決定", exact: true }).click();
  }
  await expect(page.locator(".judgment")).toBeVisible();
  await expect(page.locator(".judgment")).toHaveCount(0);
}
test("full welcome, EASY, results, review, cards, shop, missions, settings, backup and offline", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await onboard(page);
  await page.screenshot({ path: "test-results/home-844.png" });
  let s = await getState(page);
  expect(s.packs[0].draws).toHaveLength(10);
  expect(
    s.ledger.filter((e: any) => e.eventId === "pack:WELCOME-V1"),
  ).toHaveLength(1);
  await page.getByRole("button", { name: /ログイン.*ボーナス/ }).click();
  await page.getByRole("button", { name: "受取", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "受取済み", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await begin(page);
  for (let i = 0; i < 10; i++) await answerCurrent(page, i === 0);
  await expect(page.getByText("STAGE RESULT", { exact: true })).toBeVisible();
  await page.locator(".results").click({ position: { x: 10, y: 10 } });
  await expect(page.locator(".results.revealing")).toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const header = document
            .querySelector(".status-bar")!
            .getBoundingClientRect(),
          panel = document.querySelector(".results")!.getBoundingClientRect();
        return panel.top >= header.bottom;
      }),
    )
    .toBe(true);
  await page.screenshot({ path: "test-results/result-844.png" });
  s = await getState(page);
  const rp = s.wallet[0].rp;
  expect(s.results[0].correctCount).toBe(9);
  expect(s.results[0].rp).toBe(440);
  await page.getByRole("button", { name: "レビュー", exact: true }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "次の問題", exact: true }).click();
  await page.screenshot({ path: "test-results/review-844.png" });
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  expect((await getState(page)).wallet[0].rp).toBe(rp);
  for (const [name, title] of [
    ["カード", "所持カード・編成"],
    ["図鑑", "図鑑"],
    ["ミッション", "ミッション"],
    ["ショップ", "好きな一枚に、出会おう。"],
  ]) {
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: new RegExp(title) }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/" + name + "-844.png" });
  }
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "カード", exact: true })
    .click();
  await page.locator(".card-grid .card").first().click();
  await page.getByRole("button", { name: /^強化/ }).click();
  await page.getByRole("button", { name: "決定", exact: true }).click();
  await expect(page.getByText("LEVEL UP!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  expect((await getState(page)).wallet[0].rp).toBe(rp - 100);
  await page
    .getByRole("button", { name: "メニュー・設定", exact: true })
    .click();
  await page.getByRole("button", { name: "バックアップ", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップを保存", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/mrs-english-backup/);
  await file.saveAs("test-results/backup.json");
  await page
    .locator("input[type=file]")
    .setInputFiles("test-results/backup.json");
  await expect(
    page.getByRole("heading", { name: "バックアップを復元" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "決定", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /TAP TO START/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /TAP TO START/ }).click();
  await expect(page.locator(".home")).toBeVisible();
  expect(
    (await getState(page)).ledger.filter(
      (e: any) => e.eventId === "pack:WELCOME-V1",
    ),
  ).toHaveLength(1);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 60000,
    })
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /TAP TO START/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /TAP TO START/ }).click();
  await begin(page, "HARD");
  await answerCurrent(page);
  await page.screenshot({ path: "test-results/hard-offline-844.png" });
  expect(
    await page
      .locator("img")
      .evaluateAll((imgs) =>
        imgs
          .filter(
            (i) =>
              !(i as HTMLImageElement).complete ||
              !(i as HTMLImageElement).naturalWidth,
          )
          .map((i) => i.getAttribute("src")),
      ),
  ).toEqual([]);
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "再開", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /TAP TO START/ }).click();
  await expect(
    page.getByRole("button", { name: "再開", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "再開", exact: true }).click();
  for (let i = 1; i < 10; i++) await answerCurrent(page);
  await expect(page.getByText("STAGE RESULT", { exact: true })).toBeVisible();
  const finalState = await getState(page);
  expect(
    finalState.stageBest.find((b: any) => b.bestStars === 3),
  ).toBeDefined();
  expect(finalState.results.find((r: any) => r.correctCount === 10).rp).toBe(
    750,
  );
  expect(errors).toEqual([]);
});
for (const width of [667, 812, 844, 852])
  test(`landscape ${width} and portrait pause, NORMAL tap blocks`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 852 ? 393 : 375 });
    await onboard(page);
    await begin(page, "NORMAL");
    await answerCurrent(page);
    await page.screenshot({ path: `test-results/normal-${width}.png` });
    const before = await getState(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(
      page.getByRole("heading", { name: "端末を横向きにしてください" }),
    ).toBeVisible();
    await page.waitForTimeout(400);
    const paused = await getState(page);
    expect(paused.runs[0].paused).toBe(true);
    await page.setViewportSize({ width, height: 375 });
    await page.getByRole("button", { name: "再開", exact: true }).click();
    await answerCurrent(page);
    expect((await getState(page)).runs[0].answers.length).toBe(
      before.runs[0].answers.length + 1,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test("paid single/ten packs commit once, grant before reveal and restore the same draws", async ({
  page,
}) => {
  await onboard(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("mrs-english");
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction(["wallet", "ledger"], "readwrite");
    const wallet = tx.objectStore("wallet");
    const request = wallet.get("singleton");
    request.onsuccess = () => {
      const s = request.result;
      s.rp += 20000;
      wallet.put(s, "singleton");
      tx.objectStore("ledger").put(
        {
          eventId: "test-funding",
          type: "test-only",
          amountRP: 20000,
          amountXP: 0,
          balanceAfter: s.rp,
          createdAt: new Date().toISOString(),
        },
        "test-funding",
      );
    };
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  });
  await page.reload();
  await page.getByRole("button", { name: /TAP TO START/ }).click();
  for (const n of [1, 10]) {
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "ショップ", exact: true })
      .click();
    const before = (await getState(page)).wallet[0].rp;
    await page
      .getByRole("button", {
        name: n === 1 ? "1,000 RP で購入" : "9,000 RP で購入",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "決定", exact: true }).click();
    let st = await getState(page);
    const pack = st.packs.find(
      (p: any) => p.source === "shop" && p.status === "revealing",
    );
    expect(pack.draws.length).toBe(n);
    expect(st.wallet[0].rp).toBe(
      before - (n === 1 ? 1000 : 9000) + pack.refund,
    );
    const draws = JSON.stringify(pack.draws);
    if (n === 10)
      for (let i = 0; i < 3; i++)
        await page.getByRole("button", { name: "次へ", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: /TAP TO START/ }).click();
    st = await getState(page);
    expect(
      JSON.stringify(st.packs.find((p: any) => p.id === pack.id).draws),
    ).toBe(draws);
    expect(
      st.ledger.filter((e: any) => e.eventId === "pack:" + pack.id).length,
    ).toBe(1);
    await page.getByRole("button", { name: "一覧へ", exact: true }).click();
    await page
      .getByRole("button", { name: "受取済み・ショップへ", exact: true })
      .click();
    expect((await getState(page)).wallet[0].rp).toBe(st.wallet[0].rp);
  }
});

test("TIME UP keeps accepting correct answers at 700 points with no premature reward", async ({
  page,
}) => {
  await onboard(page);
  await begin(page);
  await expect(page.locator(".time-up")).toContainText("回答できます", {
    timeout: 35000,
  });
  await page.screenshot({ path: "test-results/time-up.png" });
  const before = await getState(page),
    run = before.runs.find((r: any) => r.status === "active"),
    q = questions.find((q: any) => q.id === run.questionOrder[0]);
  await page
    .locator(".options")
    .getByRole("button", {
      name: q.data.options.find((o: any) => o.isCorrect).text,
      exact: true,
    })
    .click();
  const after = await getState(page);
  expect(after.runs[0].answers[0].accuracy).toBe(700);
  expect(after.runs[0].answers[0].speed).toBe(0);
  expect(after.runs[0].answers[0].judgment).toBe("GOOD");
  expect(after.wallet[0].rp).toBe(before.wallet[0].rp);
});
test("second tab stops editing in the old tab and does not regrant welcome", async ({
  page,
  context,
}) => {
  await onboard(page);
  const other = await context.newPage();
  await other.goto("/");
  await expect(
    page.getByRole("heading", { name: "別タブで開かれています" }),
  ).toBeVisible();
  await other.getByRole("button", { name: /TAP TO START/ }).click();
  await expect(other.locator(".home")).toBeVisible();
  expect(
    (await getState(other)).ledger.filter(
      (e: any) => e.eventId === "pack:WELCOME-V1",
    ),
  ).toHaveLength(1);
  await other.close();
});
