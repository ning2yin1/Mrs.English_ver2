import { openDB, type IDBPDatabase } from "idb";
import { fresh, nicknameValid, type State } from "./engine";
import {
  cardMap,
  questionMap,
  exampleMap,
  members,
  backgrounds,
} from "./content";
const stores = Object.keys(fresh()) as (keyof State)[];
const singleton = new Set(["profile", "settings", "wallet", "meta", "team"]);
let dbPromise: Promise<IDBPDatabase> | undefined;
export function database() {
  return (dbPromise ??= openDB("mrs-english", 1, {
    upgrade(db) {
      for (const name of stores) db.createObjectStore(name);
    },
  }));
}
async function read(tx: any): Promise<State> {
  const s: any = {};
  await Promise.all(
    stores.map(async (name) => {
      const store = tx.objectStore(name);
      if (singleton.has(name)) s[name] = await store.get("singleton");
      else {
        const [keys, values] = await Promise.all([
          store.getAllKeys(),
          store.getAll(),
        ]);
        s[name] = Object.fromEntries(
          keys.map((k: any, i: number) => [k, values[i]]),
        );
      }
    }),
  );
  return s.profile ? s : fresh();
}
export async function load(validate = true) {
  const db = await database();
  const tx = db.transaction(stores, "readonly");
  const s = await read(tx);
  await tx.done;
  if (
    validate &&
    (s.meta.schemaVersion !== 1 || s.meta.contentVersion !== "2026-10-27-v2")
  )
    throw Error(
      "未対応のセーブです。バックアップを保持して対応版を利用してください",
    );
  if (validate && s.profile.onboardingComplete) validateState(s);
  return s;
}
export async function mutate<T>(
  fn: (s: State) => T,
): Promise<{ state: State; value: T }> {
  const db = await database();
  const tx = db.transaction(stores, "readwrite");
  try {
    const s = await read(tx);
    const before = structuredClone(s);
    const value = fn(s);
    if (value instanceof Promise)
      throw Error("非同期処理は保存トランザクション内で使用できません");
    s.meta.saveRevision++;
    for (const name of stores) {
      const store = tx.objectStore(name);
      if (singleton.has(name)) {
        if (JSON.stringify(s[name]) !== JSON.stringify(before[name]))
          await store.put(s[name], "singleton");
      } else {
        const rows = s[name] as Record<string, any>,
          old = before[name] as Record<string, any>;
        for (const key of Object.keys(old))
          if (!(key in rows)) await store.delete(key);
        for (const [key, value] of Object.entries(rows))
          if (JSON.stringify(value) !== JSON.stringify(old[key]))
            await store.put(value, key);
      }
    } // Ensure first-time singleton records are stored as well.
    for (const name of stores.filter((x) => singleton.has(x)))
      if (!(await tx.objectStore(name).get("singleton")))
        await tx.objectStore(name).put(s[name], "singleton");
    await tx.done;
    return { state: s, value };
  } catch (e) {
    try {
      tx.abort();
    } catch {}
    await tx.done.catch(() => {});
    throw e;
  }
}
export function canonical(value: any): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
      .join(",") +
    "}"
  );
}
export async function digest(s: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function backup(s: State) {
  return {
    format: "MrsEnglishBackup",
    schemaVersion: 1,
    contentVersion: s.meta.contentVersion,
    exportedAt: new Date().toISOString(),
    payload: s,
    sha256: await digest(canonical(s)),
  };
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error("バックアップを読み込めません：" + message);
}
const obj = (v: any) =>
  v !== null && typeof v === "object" && !Array.isArray(v);
export function validateState(s: any): asserts s is State {
  assert(obj(s) && stores.every((k) => obj(s[k])), "ストア構造");
  assert(
    s.meta.schemaVersion === 1 && s.meta.contentVersion === "2026-10-27-v2",
    "未対応のバージョン",
  );
  const safe = (v: any) => Number.isSafeInteger(v) && v >= 0;
  assert(
    safe(s.wallet.rp) &&
      safe(s.wallet.xp) &&
      safe(s.wallet.revision) &&
      safe(s.meta.saveRevision),
    "RP・XP",
  );
  assert(
    typeof s.profile.nickname === "string" &&
      nicknameValid(s.profile.nickname) &&
      members.some((m) => m.id === s.profile.favoriteMemberId) &&
      backgrounds.some((b) => b.id === s.profile.homeBackgroundId) &&
      typeof s.profile.onboardingComplete === "boolean",
    "プロフィール",
  );
  assert(s.packs["WELCOME-V1"], "初回権利");
  assert(
    safe(s.meta.streak) &&
      typeof s.meta.lastStudyDate === "string" &&
      typeof s.meta.lastClaimDate === "string",
    "学習日",
  );
  assert(
    typeof s.settings.soundEnabled === "boolean" &&
      typeof s.settings.reduceMotion === "boolean" &&
      s.settings.ttsRate >= 0.5 &&
      s.settings.ttsRate <= 1.5 &&
      s.settings.photoOverlay >= 0.4 &&
      s.settings.photoOverlay <= 0.7,
    "設定",
  );
  for (const [id, c] of Object.entries(s.ownedCards) as [string, any][]) {
    assert(Object.hasOwn(cardMap, id) && obj(c), "カードID");
    const max = (
      { C: 10, B: 20, A: 30, S: 40, R: 50 } as Record<string, number>
    )[cardMap[id].rank];
    assert(
      Number.isInteger(c.level) && c.level >= 1 && c.level <= max,
      "カードLv",
    );
  }
  assert(
    Object.keys(s.team).every((k) => members.some((m) => m.id === k)),
    "編成枠",
  );
  for (const [m, id] of Object.entries(s.team) as [string, string][]) {
    assert(
      Object.hasOwn(s.ownedCards, id) &&
        Object.hasOwn(cardMap, id) &&
        cardMap[id].memberId === m,
      "編成",
    );
  }
  let rp = 0,
    xp = 0;
  for (const [id, e] of Object.entries(s.ledger) as [string, any][]) {
    assert(
      e.eventId === id &&
        Number.isSafeInteger(e.amountRP) &&
        safe(e.amountXP) &&
        safe(e.balanceAfter) &&
        typeof e.type === "string",
      "台帳",
    );
    rp += e.amountRP;
    xp += e.amountXP;
  }
  assert(rp === s.wallet.rp && xp === s.wallet.xp, "台帳と残高の不一致");
  for (const [id, m] of Object.entries(s.mistakes) as [string, any][]) {
    assert(
      Object.hasOwn(exampleMap, id) &&
        ["EASY", "NORMAL", "HARD"].includes(m.difficulty) &&
        typeof m.lastWrongAt === "string",
      "苦手問題",
    );
  }
  assert(
    Object.values(s.runs).filter((r: any) => r.status === "active").length <= 1,
    "進行中の学習数",
  );
  for (const [id, r] of Object.entries(s.runs) as [string, any][]) {
    assert(
      r.id === id &&
        ["standard", "review"].includes(r.type) &&
        ["active", "completed", "abandoned"].includes(r.status),
      "学習ID",
    );
    assert(
      Array.isArray(r.questionOrder) &&
        r.questionOrder.length > 0 &&
        r.questionOrder.length <= 10 &&
        r.questionOrder.every((q: string) => Object.hasOwn(questionMap, q)),
      "問題ID",
    );
    assert(
      Number.isInteger(r.questionIndex) &&
        r.questionIndex >= 0 &&
        r.questionIndex <= r.questionOrder.length &&
        Array.isArray(r.answers) &&
        r.answers.length === r.questionIndex,
      "回答数",
    );
    assert(
      Number.isFinite(r.elapsed) &&
        r.elapsed >= 0 &&
        typeof r.paused === "boolean" &&
        Array.isArray(r.input),
      "計時・入力",
    );
    assert(
      backgrounds.some((b) => b.id === r.backgroundId),
      "学習背景",
    );
    assert(
      Array.isArray(r.optionOrders) &&
        r.optionOrders.length === r.questionOrder.length,
      "選択肢",
    );
    r.optionOrders.forEach((o: string[], i: number) => {
      const q = questionMap[r.questionOrder[i]],
        valid = q.difficulty === "EASY" ? q.data.options : q.data.blocks;
      assert(
        Array.isArray(o) &&
          o.length === valid.length &&
          new Set(o).size === o.length &&
          o.every((x) => valid.some((v: any) => v.id === x)),
        "選択肢ID",
      );
    });
    assert(
      r.teamSnapshot.length <= 3 &&
        new Set(r.teamSnapshot.map((c: any) => cardMap[c.id]?.memberId))
          .size === r.teamSnapshot.length,
      "編成記録",
    );
    for (const c of r.teamSnapshot)
      assert(
        Object.hasOwn(cardMap, c.id) &&
          Number.isInteger(c.level) &&
          c.level >= 1 &&
          c.level <=
            ({ C: 10, B: 20, A: 30, S: 40, R: 50 } as Record<string, number>)[
              cardMap[c.id].rank
            ],
        "編成Lv",
      );
    r.answers.forEach((a: any, i: number) =>
      assert(
        a.questionId === r.questionOrder[i] &&
          typeof a.correct === "boolean" &&
          Number.isFinite(a.elapsed) &&
          a.elapsed >= 0 &&
          typeof a.text === "string",
        "回答記録",
      ),
    );
  }
  for (const [id, p] of Object.entries(s.packs) as [string, any][]) {
    assert(
      p.id === id &&
        ["entitled", "revealing", "completed"].includes(p.status) &&
        Array.isArray(p.draws) &&
        p.draws.length <= 10 &&
        safe(p.cursor) &&
        p.cursor <= p.draws.length,
      "パック",
    );
    assert(
      p.status === "entitled" || !!s.ledger["pack:" + id],
      "パック付与履歴",
    );
    for (const d of p.draws)
      assert(
        Object.hasOwn(cardMap, d.cardId) &&
          typeof d.duplicate === "boolean" &&
          safe(d.rp),
        "抽選ID",
      );
  }
  for (const [id, r] of Object.entries(s.results) as [string, any][]) {
    assert(
      s.runs[id]?.status === "completed" &&
        s.ledger["finish:" + id] &&
        r.runId === id &&
        safe(r.total) &&
        safe(r.english) &&
        safe(r.rp) &&
        safe(r.correctCount) &&
        r.correctCount <= s.runs[id].questionOrder.length &&
        Array.isArray(r.answerDetails),
      "結果",
    );
  }
  for (const [id, b] of Object.entries(s.stageBest) as [string, any][]) {
    assert(
      /^G(0[1-9]|[1-5][0-9]|60):(EASY|NORMAL|HARD)$/.test(id) &&
        safe(b.bestTotal) &&
        safe(b.bestEnglish) &&
        safe(b.bestStars) &&
        b.bestStars <= 3 &&
        safe(b.paidStarMilestone) &&
        b.paidStarMilestone <= 3,
      "ステージ記録",
    );
  }
  for (const m of Object.values(s.missions) as any[]) {
    assert(
      safe(m.progress) &&
        typeof m.claimed === "boolean" &&
        Array.isArray(m.reviewedExampleIds) &&
        new Set(m.reviewedExampleIds).size === m.reviewedExampleIds.length &&
        m.reviewedExampleIds.every((id: string) =>
          Object.hasOwn(exampleMap, id),
        ),
      "ミッション",
    );
  }
}
export async function parseBackup(text: string) {
  assert(
    new TextEncoder().encode(text).length <= 20 * 1024 * 1024,
    "20MBを超えています",
  );
  const b = JSON.parse(text);
  assert(
    b.format === "MrsEnglishBackup" &&
      b.schemaVersion === 1 &&
      b.contentVersion === "2026-10-27-v2",
    "形式またはバージョン",
  );
  assert((await digest(canonical(b.payload))) === b.sha256, "ハッシュ不一致");
  validateState(b.payload);
  return b.payload as State;
}
export async function recoveryBackup() {
  const db = await openDB("mrs-english-recovery", 1, {
    upgrade(db) {
      db.createObjectStore("backups");
    },
  });
  const b = await db.get("backups", "beforeRestore");
  db.close();
  return b;
}
export async function replace(s: State) {
  validateState(s);
  // Keep the old save on the device even when Safari blocks a second download.
  const previous = await load(false);
  const recovery = await backup(previous);
  const recoveryDB = await openDB("mrs-english-recovery", 1, {
    upgrade(db) {
      db.createObjectStore("backups");
    },
  });
  await recoveryDB.put("backups", recovery, "beforeRestore");
  recoveryDB.close();
  const db = await database();
  const tx = db.transaction(stores, "readwrite");
  for (const name of stores) {
    const store = tx.objectStore(name);
    await store.clear();
    if (singleton.has(name)) await store.put(s[name], "singleton");
    else for (const [k, v] of Object.entries(s[name])) await store.put(v, k);
  }
  await tx.done;
}
