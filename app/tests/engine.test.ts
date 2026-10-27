import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  fresh,
  entitle,
  openPack,
  score,
  stars,
  bonus,
  teamBonus,
  cost,
  upgrade,
  equip,
  recommend,
  startRun,
  answer,
  finish,
  claim,
  login,
  reviewExample,
  dateKey,
  weekKey,
  nicknameValid,
} from "../src/engine";
import {
  cards,
  cardMap,
  members,
  questionMap,
  questions,
  examples,
  curriculum,
} from "../src/content";
import {
  load,
  mutate,
  backup,
  parseBackup,
  replace,
  canonical,
  digest,
  recoveryBackup,
} from "../src/db";
const setup = () => {
  const s = fresh();
  s.profile.nickname = "テスト";
  s.profile.favoriteMemberId = "motoki";
  entitle(s);
  return s;
};
const fund = (s: ReturnType<typeof fresh>, amount: number) => {
  const delta = amount - s.wallet.rp;
  s.wallet.rp = amount;
  s.ledger["test-fund"] = {
    eventId: "test-fund",
    amountRP: delta,
    amountXP: 0,
    balanceAfter: amount,
    type: "test",
  };
};
const play = (
  s: ReturnType<typeof fresh>,
  n = 10,
  now = new Date("2026-10-26T10:00:00Z"),
) => {
  const r = startRun(s, "G01", "EASY");
  for (let i = 0; i < 10; i++) {
    const q = questionMap[r.questionOrder[i]];
    answer(
      s,
      r.id,
      i,
      [
        i < n
          ? q.data.correctOptionId
          : q.data.options.find((o: any) => !o.isCorrect).id,
      ],
      1000,
    );
  }
  return finish(s, r.id, now);
};
describe("scoring and supplied boundaries", () => {
  it.each([
    [true, 0, 10, 1000, "SUPER PERFECT"],
    [true, 2, 10, 940, "SUPER PERFECT"],
    [true, 2.001, 10, 940, "PERFECT"],
    [true, 6, 10, 820, "PERFECT"],
    [true, 6.001, 10, 820, "GOOD"],
    [true, 10, 10, 700, "GOOD"],
    [true, 50, 10, 700, "GOOD"],
    [false, 0, 10, 0, "MISS"],
  ])("%j", (ok, t, T, expected, j) => {
    const s = score(ok as boolean, t as number, T as number);
    expect(s.accuracy + s.speed).toBe(expected);
    expect(s.judgment).toBe(j);
  });
  it("all star boundaries", () =>
    expect(Array.from({ length: 11 }, (_, i) => stars(i))).toEqual([
      0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3,
    ]));
  it("rank endpoints and R50 max total", () => {
    for (const c of cards) {
      expect(bonus(c.id, 1)).toBe(0);
      const max = { C: 10, B: 20, A: 30, S: 40, R: 50 }[c.rank];
      expect(bonus(c.id, max!)).toBe(
        { C: 0.1, B: 0.2, A: 0.35, S: 0.55, R: 0.8 }[c.rank],
      );
    }
    const r = cards.find((c) => c.rank === "R")!;
    expect(
      Math.round(
        10000 *
          (1 +
            teamBonus(
              Array.from({ length: 3 }, () => ({ id: r.id, level: 50 })),
            )),
      ),
    ).toBe(18000);
    expect(teamBonus([])).toBe(0);
  });
  it("score reward 9 correct, replay, 2→3 stars", () => {
    const s = setup();
    const a = play(s, 9);
    expect(a.rp).toBe(440);
    expect(finish(s, a.runId).rp).toBe(440);
    expect(s.wallet.rp).toBe(440);
    expect(play(s, 10).rp).toBe(450);
    expect(play(s, 0).rp).toBe(50);
    expect(s.stageBest["G01:EASY"].bestStars).toBe(3);
  });
  it("first perfect reward 750", () => expect(play(setup(), 10).rp).toBe(750));
});
describe("content, answers and snapshots", () => {
  it("real content counts", () => {
    expect(curriculum.length).toBe(60);
    expect(examples.length).toBe(600);
    expect(questions.length).toBe(1800);
    expect(cards.length).toBe(79);
  });
  it("all 1800 canonical answers accepted", () => {
    const s = setup();
    for (const q of questions) {
      const r = startRun(s, q.grammarId, q.difficulty as any);
      r.questionOrder = [q.id];
      r.optionOrders = [[]];
      const input =
        q.difficulty === "EASY"
          ? [(q.data as any).correctOptionId]
          : (q.data as any).correctOrder;
      expect(answer(s, r.id, 0, input, 35000)?.correct, q.id).toBe(true);
      expect(r.answers[0].speed).toBe(0);
      r.status = "abandoned";
    }
  });
  it("same-text IDs are interchangeable", () => {
    const s = setup();
    const q = structuredClone(questionMap["G01-E01-NORMAL"]);
    q.id = "test-same-text";
    q.data.blocks = [
      { id: "a", text: "the" },
      { id: "b", text: "the" },
    ];
    q.data.correctOrder = ["a", "b"];
    q.data.acceptedOrders = [["a", "b"]];
    questionMap[q.id] = q;
    try {
      const r = startRun(s, q.grammarId, "NORMAL");
      r.questionOrder = [q.id];
      expect(answer(s, r.id, 0, ["b", "a"], 1000)?.correct).toBe(true);
    } finally {
      delete questionMap[q.id];
    }
  });
  it("duplicate answer is ignored and team snapshot survives upgrade", () => {
    const s = setup();
    openPack(s, "WELCOME-V1");
    const r = startRun(s, "G01", "EASY");
    const q = questionMap[r.questionOrder[0]],
      id = Object.values(s.team)[0];
    const snap = structuredClone(r.teamSnapshot);
    fund(s, 5000);
    upgrade(s, id, "u");
    expect(r.teamSnapshot).toEqual(snap);
    answer(s, r.id, 0, [q.data.correctOptionId], 500);
    expect(answer(s, r.id, 0, [q.data.correctOptionId], 500)).toBeNull();
    expect(r.answers.length).toBe(1);
  });
});
describe("packs and economy", () => {
  it("welcome guarantee, idempotency and duplicate levels", () => {
    const s = setup();
    openPack(s, "WELCOME-V1");
    expect(s.packs["WELCOME-V1"].draws).toHaveLength(10);
    expect(
      new Set(
        s.packs["WELCOME-V1"].draws.map((d: any) => cardMap[d.cardId].memberId),
      ).size,
    ).toBe(3);
    const snapshot = structuredClone(s);
    openPack(s, "WELCOME-V1");
    expect(s).toEqual(snapshot);
    entitle(s);
    expect(s.packs["WELCOME-V1"].status).toBe("revealing");
  });
  it.each([
    [999, 1, false],
    [1000, 1, true],
    [8999, 10, false],
    [9000, 10, true],
  ])("purchase boundary %i", (rp, n, ok) => {
    const s = setup();
    fund(s, rp);
    if (ok) {
      openPack(s, "paid", n);
      expect(s.packs.paid.price).toBe(n === 1 ? 1000 : 9000);
      const before = structuredClone(s);
      openPack(s, "paid", n);
      expect(s).toEqual(before);
    } else expect(() => openPack(s, "paid", n)).toThrow("RP");
  });
  it("upgrades cost, max and no double spend", () => {
    const s = setup();
    openPack(s, "WELCOME-V1");
    fund(s, 10000);
    const id = Object.keys(s.ownedCards)[0];
    const old = s.wallet.rp;
    upgrade(s, id, "up");
    expect(s.wallet.rp).toBe(old - 100);
    upgrade(s, id, "up");
    expect(s.ownedCards[id].level).toBe(2);
    expect(cost(2)).toBe(120);
    s.ownedCards[id].level = { C: 10, B: 20, A: 30, S: 40, R: 50 }[
      cardMap[id].rank
    ]!;
    expect(() => upgrade(s, id, "max")).toThrow("MAX");
  });
  it("one member per slot and no unowned equip", () => {
    const s = setup();
    openPack(s, "WELCOME-V1");
    for (const id of Object.keys(s.ownedCards)) equip(s, id);
    expect(Object.keys(s.team)).toHaveLength(3);
    expect(() => equip(s, "bogus")).toThrow();
    recommend(s);
    expect(
      new Set(Object.values(s.team).map((id) => cardMap[id].memberId)).size,
    ).toBe(3);
  });
});
describe("time, missions and review", () => {
  it("Tokyo boundaries and Monday week", () => {
    expect(dateKey(new Date("2026-10-25T14:59:59Z"))).toBe("2026-10-25");
    expect(dateKey(new Date("2026-10-25T15:00:00Z"))).toBe("2026-10-26");
    expect(weekKey(new Date("2026-10-25T15:00:00Z"))).toBe("2026-10-26");
  });
  it("Monday does not double progress, claims idempotent, login rollback blocked", () => {
    const s = setup(),
      now = new Date("2026-10-26T00:00:00Z");
    play(s, 10, now);
    expect(s.missions["2026-10-26:D-CORRECT"].progress).toBe(10);
    expect(s.missions["2026-10-26:W-CORRECT"].progress).toBe(10);
    const rp = s.wallet.rp;
    claim(s, "D-CORRECT", now);
    claim(s, "D-CORRECT", now);
    expect(s.wallet.rp).toBe(rp + 100);
    login(s, now);
    login(s, now);
    login(s, new Date("2026-10-24"));
    expect(s.wallet.rp).toBe(rp + 150);
  });
  it("five distinct reviews", () => {
    const s = setup();
    for (let i = 0; i < 10; i++) reviewExample(s, "G01-E01");
    expect(s.missions[dateKey() + ":D-REVIEW"].progress).toBe(1);
    for (let i = 2; i <= 5; i++) reviewExample(s, "G01-E0" + i);
    expect(s.missions[dateKey() + ":D-REVIEW"].progress).toBe(5);
  });
  it("review 1/9/10/11, correct removes mistake, no best updates", () => {
    for (const n of [1, 9, 10, 11]) {
      const s = setup();
      for (const q of questions
        .filter((q) => q.difficulty === "EASY")
        .slice(0, n))
        s.mistakes[q.exampleId] = {
          difficulty: "EASY",
          lastWrongAt: new Date().toISOString(),
        };
      const r = startRun(s, "G01", "EASY", "review");
      expect(r.questionOrder.length).toBe(Math.min(n, 10));
      for (let i = 0; i < r.questionOrder.length; i++)
        answer(
          s,
          r.id,
          i,
          [questionMap[r.questionOrder[i]].data.correctOptionId],
          1000,
        );
      const result = finish(s, r.id);
      expect(result.rp).toBe(Math.min(n, 10) * 10 + 50);
      expect(s.stageBest).toEqual({});
      expect(Object.keys(s.mistakes).length).toBe(Math.max(0, n - 10));
    }
    expect(() => startRun(setup(), "G01", "EASY", "review")).toThrow();
  });
  it("nickname graphemes/control/html", () => {
    expect(nicknameValid("👨‍👩‍👧‍👦")).toBe(true);
    expect(nicknameValid(" ")).toBe(false);
    expect(nicknameValid("a\nb")).toBe(false);
    expect(nicknameValid("a".repeat(13))).toBe(false);
    expect(nicknameValid("<b>abc</b>")).toBe(true);
  });
});
describe("actual IndexedDB atomicity and backups", () => {
  beforeEach(async () => {
    await replace(setup());
  });
  it("simultaneous welcome grants once across transactions and reload", async () => {
    await Promise.all(
      Array.from({ length: 5 }, () => mutate((s) => openPack(s, "WELCOME-V1"))),
    );
    const s = await load();
    expect(Object.keys(s.ledger)).toEqual(["pack:WELCOME-V1"]);
    expect(s.packs["WELCOME-V1"].draws.length).toBe(10);
    expect(Object.keys(s.team).length).toBe(3);
  });
  it("insufficient purchase rolls back all writes", async () => {
    const before = await load();
    await expect(mutate((s) => openPack(s, "no-money", 10))).rejects.toThrow();
    expect(await load()).toEqual(before);
  });
  it("concurrent upgrade same event and finish once", async () => {
    await mutate((s) => {
      openPack(s, "WELCOME-V1");
      fund(s, 10000);
    });
    const id = Object.keys((await load()).ownedCards)[0];
    await Promise.all([
      mutate((s) => upgrade(s, id, "upgrade-one")),
      mutate((s) => upgrade(s, id, "upgrade-one")),
    ]);
    expect((await load()).ownedCards[id].level).toBe(2);
    const result = await mutate((s) => play(s));
    const runId = result.value.runId;
    const rp = (await load()).wallet.rp;
    await Promise.all([
      mutate((s) => finish(s, runId)),
      mutate((s) => finish(s, runId)),
    ]);
    expect((await load()).wallet.rp).toBe(rp);
  });
  it("restore keeps a complete local recovery backup", async () => {
    await mutate((s) => {
      openPack(s, "WELCOME-V1");
      play(s, 9);
    });
    const previous = await load();
    await replace(setup());
    expect((await recoveryBackup()).payload).toEqual(previous);
  });
  it("zero-score result backup survives JSON normalization", async () => {
    await mutate((s) => {
      play(s, 0);
    });
    const b = await backup(await load());
    expect(await parseBackup(JSON.stringify(b))).toEqual(
      JSON.parse(JSON.stringify(b.payload)),
    );
  });
  it("backup roundtrip and corruption/new version/unknown IDs/level/negative rp/ledger rejects", async () => {
    await mutate((s) => {
      openPack(s, "WELCOME-V1");
      play(s);
    });
    const s = await load(),
      b = await backup(s);
    expect(await parseBackup(JSON.stringify(b))).toEqual(s);
    for (const change of [
      (p: any) => (p.wallet.rp = -1),
      (p: any) => (p.meta.schemaVersion = 9),
      (p: any) => (p.ownedCards.bogus = { level: 1 }),
      (p: any) => (p.ownedCards[Object.keys(p.ownedCards)[0]].level = 100),
      (p: any) =>
        (p.ledger.fake = {
          eventId: "duplicate",
          amountRP: 0,
          amountXP: 0,
          balanceAfter: 0,
        }),
    ]) {
      const copy = structuredClone(b);
      change(copy.payload);
      copy.sha256 = await digest(canonical(copy.payload));
      await expect(parseBackup(JSON.stringify(copy))).rejects.toThrow();
    }
    const bad = structuredClone(b);
    bad.sha256 = "wrong";
    await expect(parseBackup(JSON.stringify(bad))).rejects.toThrow("ハッシュ");
    expect(await load()).toEqual(s);
    await replace(await parseBackup(JSON.stringify(b)));
    expect(await load()).toEqual(s);
  });
});
