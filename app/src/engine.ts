import { cards, cardMap, questionMap, rules, members } from "./content";
export type Difficulty = "EASY" | "NORMAL" | "HARD";
export type Run = {
  id: string;
  type: "standard" | "review";
  grammarId: string;
  difficulty: Difficulty;
  questionOrder: string[];
  optionOrders: string[][];
  backgroundId: string;
  teamSnapshot: { id: string; level: number }[];
  questionIndex: number;
  answers: any[];
  elapsed: number;
  input: string[];
  status: "active" | "completed" | "abandoned";
  paused: boolean;
};
export type State = {
  profile: {
    nickname: string;
    favoriteMemberId: string;
    homeBackgroundId: string;
    onboardingStep: number;
    onboardingComplete: boolean;
  };
  settings: {
    soundEnabled: boolean;
    ttsRate: number;
    photoOverlay: number;
    reduceMotion: boolean;
  };
  wallet: { rp: number; xp: number; revision: number };
  ownedCards: Record<
    string,
    { level: number; obtainedAt: string; favorite: boolean; locked: boolean }
  >;
  team: Record<string, string>;
  packs: Record<string, any>;
  runs: Record<string, Run>;
  results: Record<string, any>;
  stageBest: Record<string, any>;
  mistakes: Record<string, any>;
  missions: Record<string, any>;
  calendar: Record<string, any>;
  ledger: Record<string, any>;
  meta: {
    schemaVersion: number;
    contentVersion: string;
    saveRevision: number;
    lastClaimDate: string;
    lastStudyDate: string;
    streak: number;
    lastBackupAt: string;
    lastGrammarId?: string;
    lastDifficulty?: Difficulty;
  };
};
export const fresh = (): State => ({
  profile: {
    nickname: "",
    favoriteMemberId: "",
    homeBackgroundId: "bg-01",
    onboardingStep: 0,
    onboardingComplete: false,
  },
  settings: {
    soundEnabled: true,
    ttsRate: 0.85,
    photoOverlay: 0.55,
    reduceMotion: false,
  },
  wallet: { rp: 0, xp: 0, revision: 0 },
  ownedCards: {},
  team: {},
  packs: {},
  runs: {},
  results: {},
  stageBest: {},
  mistakes: {},
  missions: {},
  calendar: {},
  ledger: {},
  meta: {
    schemaVersion: 1,
    contentVersion: "2026-10-27-v2",
    saveRevision: 0,
    lastClaimDate: "",
    lastStudyDate: "",
    streak: 0,
    lastBackupAt: "",
  },
});
export const uuid = () => crypto.randomUUID();
export function randomInt(n: number) {
  const b = new Uint32Array(1);
  const max = Math.floor(4294967296 / n) * n;
  do {
    crypto.getRandomValues(b);
  } while (b[0] >= max);
  return b[0] % n;
}
export function shuffle<T>(xs: T[], rng = randomInt) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const dateKey = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
export function weekKey(d = new Date()) {
  const key = dateKey(d);
  const t = new Date(key + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}
export const stars = (n: number) =>
  n === 10 ? 3 : n >= 8 ? 2 : n >= 6 ? 1 : 0;
export function score(correct: boolean, elapsed: number, T: number) {
  const fraction = Math.max(0, 1 - Math.max(0, elapsed) / T);
  return {
    accuracy: correct ? 700 : 0,
    speed: correct ? Math.round(300 * fraction) : 0,
    judgment: !correct
      ? "MISS"
      : fraction >= 0.8
        ? "SUPER PERFECT"
        : fraction >= 0.4
          ? "PERFECT"
          : "GOOD",
  };
}
export function bonus(id: string, level: number) {
  const r = rules.ranks[cardMap[id].rank as keyof typeof rules.ranks];
  return (r.maxBonus * (level - 1)) / (r.maxLevel - 1);
}
export const teamBonus = (team: { id: string; level: number }[]) =>
  team.reduce((n, c) => n + bonus(c.id, c.level), 0) / 3;
export const cost = (level: number) => 100 + 20 * (level - 1);
function credit(
  s: State,
  eventId: string,
  rp: number,
  xp = 0,
  type = "reward",
) {
  if (s.ledger[eventId]) return false;
  const nextRP = s.wallet.rp + rp,
    nextXP = s.wallet.xp + xp;
  if (!Number.isSafeInteger(nextRP) || nextRP < 0)
    throw Error("RPが足りません");
  if (!Number.isSafeInteger(nextXP) || nextXP < 0) throw Error("XPが不正です");
  s.wallet.rp = nextRP;
  s.wallet.xp = nextXP;
  s.wallet.revision++;
  s.ledger[eventId] = {
    eventId,
    type,
    amountRP: rp,
    amountXP: xp,
    createdAt: new Date().toISOString(),
    balanceAfter: s.wallet.rp,
  };
  return true;
}
export function nicknameValid(n: string) {
  return (
    !/[\r\n\x00-\x1f\x7f]/.test(n) &&
    [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(n.trim())]
      .length >= 1 &&
    [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(n.trim())]
      .length <= 12
  );
}
export function entitle(s: State) {
  if (
    !nicknameValid(s.profile.nickname) ||
    !members.some((m) => m.id === s.profile.favoriteMemberId) ||
    !/^bg-(0[1-9]|1[0-9]|2[0-2])$/.test(s.profile.homeBackgroundId)
  )
    throw Error("初回設定を確認してください");
  s.profile.onboardingComplete = true;
  s.profile.onboardingStep = 4;
  s.packs["WELCOME-V1"] ??= {
    id: "WELCOME-V1",
    status: "entitled",
    source: "welcome",
    draws: [],
    cursor: 0,
  };
}
function draw(member: string | undefined, rng: (n: number) => number) {
  const who = member ?? members[rng(3)].id;
  let p = rng(100);
  let rank = "C";
  for (const [r, w] of Object.entries(rules.rankWeights)) {
    if (p < w) {
      rank = r;
      break;
    }
    p -= w;
  }
  const pool = cards.filter((c) => c.memberId === who && c.rank === rank);
  return pool[rng(pool.length)];
}
export function recommend(s: State) {
  for (const m of members) {
    const pool = Object.keys(s.ownedCards)
      .filter((id) => cardMap[id].memberId === m.id)
      .sort(
        (a, b) =>
          bonus(b, s.ownedCards[b].level) - bonus(a, s.ownedCards[a].level) ||
          "R S A B C".indexOf(cardMap[a].rank) -
            "R S A B C".indexOf(cardMap[b].rank) ||
          s.ownedCards[b].level - s.ownedCards[a].level ||
          a.localeCompare(b),
      );
    if (pool[0]) s.team[m.id] = pool[0];
  }
}
export function openPack(s: State, id: string, count = 10, rng = randomInt) {
  if (s.ledger["pack:" + id]) return s.packs[id];
  const welcome = id === "WELCOME-V1";
  if (welcome) count = 10;
  if (welcome && s.packs[id]?.status !== "entitled")
    throw Error("初回特典の権利がありません");
  if (!welcome && ![1, 10].includes(count)) throw Error("不正な枚数");
  const price = welcome ? 0 : count === 1 ? 1000 : 9000;
  if (s.wallet.rp < price) throw Error("RPが足りません");
  const draws = shuffle(
    Array.from({ length: count }, (_, i) =>
      draw(welcome && i < 3 ? members[i].id : undefined, rng),
    ),
    rng,
  );
  let refund = 0;
  const obtainedAt = new Date().toISOString();
  const rows = draws.map((c) => {
    const duplicate = !!s.ownedCards[c.id];
    const rp = duplicate
      ? rules.duplicateRP[c.rank as keyof typeof rules.duplicateRP]
      : 0;
    refund += rp;
    if (!duplicate)
      s.ownedCards[c.id] = {
        level: 1,
        obtainedAt,
        favorite: false,
        locked: false,
      };
    return { cardId: c.id, duplicate, rp };
  });
  credit(s, "pack:" + id, refund - price, 0, "pack");
  const pack = {
    id,
    source: welcome ? "welcome" : "shop",
    status: "revealing",
    draws: rows,
    cursor: 0,
    price,
    refund,
  };
  s.packs[id] = pack;
  if (welcome) recommend(s);
  return pack;
}
export function upgrade(s: State, id: string, eventId: string) {
  if (s.ledger[eventId]) return;
  const c = s.ownedCards[id];
  if (!c) throw Error("未取得です");
  const max =
    rules.ranks[cardMap[id].rank as keyof typeof rules.ranks].maxLevel;
  if (c.level >= max) throw Error("MAXです");
  credit(s, eventId, -cost(c.level), 0, "upgrade");
  s.ledger[eventId].cardId = id;
  c.level++;
}
export function equip(s: State, id: string) {
  if (!s.ownedCards[id]) throw Error("未取得です");
  s.team[cardMap[id].memberId] = id;
}
export function startRun(
  s: State,
  grammarId: string,
  difficulty: Difficulty,
  type: "standard" | "review" = "standard",
  rng = randomInt,
) {
  if (Object.values(s.runs).some((r) => r.status === "active"))
    throw Error("中断中の学習を再開または終了してください");
  let ids: string[];
  if (type === "review") {
    ids = Object.entries(s.mistakes)
      .sort((a, b) => a[1].lastWrongAt.localeCompare(b[1].lastWrongAt))
      .slice(0, 10)
      .map(([id, m]) => id + "-" + m.difficulty);
  } else {
    ids = Object.keys(questionMap).filter(
      (id) =>
        questionMap[id].grammarId === grammarId &&
        questionMap[id].difficulty === difficulty,
    );
    ids = shuffle(ids, rng);
  }
  if (!ids.length) throw Error("今は苦手問題がありません");
  const id = uuid();
  const run: Run = {
    id,
    type,
    grammarId,
    difficulty,
    questionOrder: ids,
    optionOrders: ids.map((id) => {
      const q = questionMap[id];
      return shuffle(
        (q.difficulty === "EASY" ? q.data.options : q.data.blocks).map(
          (x: any) => x.id,
        ) as string[],
        rng,
      );
    }),
    backgroundId: "bg-" + String(rng(22) + 1).padStart(2, "0"),
    teamSnapshot: Object.values(s.team)
      .filter(Boolean)
      .map((id) => ({ id, level: s.ownedCards[id].level })),
    questionIndex: 0,
    answers: [],
    elapsed: 0,
    input: [],
    status: "active",
    paused: true,
  };
  s.runs[id] = run;
  if (type === "standard") {
    s.meta.lastGrammarId = grammarId;
    s.meta.lastDifficulty = difficulty;
  }
  return run;
}
export function answer(
  s: State,
  runId: string,
  questionIndex: number,
  input: string[],
  elapsed: number,
) {
  const r = s.runs[runId];
  if (!r || r.status !== "active" || r.questionIndex !== questionIndex)
    return null;
  const q = questionMap[r.questionOrder[questionIndex]];
  const text =
    q.difficulty === "EASY"
      ? (q.data.options.find((o: any) => o.id === input[0])?.text ?? "")
      : input
          .map((id) => q.data.blocks.find((b: any) => b.id === id)?.text ?? "")
          .join(" ");
  const norm = (x: string) => x.normalize("NFKC").trim().replace(/\s+/g, " ");
  const correct =
    q.difficulty === "EASY"
      ? input[0] === q.data.correctOptionId
      : q.data.acceptedOrders.some(
          (order: string[]) =>
            norm(
              order
                .map((id) => q.data.blocks.find((b: any) => b.id === id).text)
                .join(" "),
            ) === norm(text),
        );
  const points = score(correct, elapsed / 1000, q.baseTimeSeconds);
  const a = {
    questionId: q.id,
    exampleId: q.exampleId,
    input,
    text,
    correct,
    elapsed,
    ...points,
  };
  r.answers.push(a);
  r.questionIndex++;
  r.elapsed = 0;
  r.input = [];
  r.paused = true;
  if (correct) delete s.mistakes[q.exampleId];
  else
    s.mistakes[q.exampleId] = {
      difficulty: q.difficulty,
      lastWrongAt: new Date().toISOString(),
      lastRunId: runId,
    };
  return a;
}
function progress(
  s: State,
  period: string,
  metric: string,
  by: number,
  scope: "daily" | "weekly",
) {
  for (const def of rules.missions[scope]) {
    if (def.metric !== metric) continue;
    const key = period + ":" + def.id;
    const m = (s.missions[key] ??= {
      progress: 0,
      claimed: false,
      reviewedExampleIds: [],
    });
    m.progress += by;
  }
}
export function finish(s: State, runId: string, now = new Date()) {
  if (s.results[runId]) return s.results[runId];
  const r = s.runs[runId];
  if (
    !r ||
    r.status !== "active" ||
    r.answers.length !== r.questionOrder.length ||
    !r.answers.length
  )
    throw Error("学習が完了していません");
  const correct = r.answers.filter((a) => a.correct).length;
  const accuracy = r.answers.reduce((n, a) => n + a.accuracy, 0),
    speed = r.answers.reduce((n, a) => n + a.speed, 0),
    english = accuracy + speed,
    total = Math.round(english * (1 + teamBonus(r.teamSnapshot)));
  const st = stars(correct);
  const key = r.grammarId + ":" + r.difficulty;
  const old = s.stageBest[key] ?? {
    bestEnglish: 0,
    bestTotal: 0,
    bestStars: 0,
    paidStarMilestone: 0,
  };
  const starRP =
    r.type === "standard"
      ? Math.max(
          0,
          rules.rewards.starCumulative[st] -
            rules.rewards.starCumulative[old.paidStarMilestone],
        )
      : 0;
  const reward = correct * 10 + 50 + starRP;
  const result = {
    runId,
    correctCount: correct,
    accuracy,
    speed,
    english,
    total,
    stars: r.type === "review" ? 0 : st,
    starRP,
    rp: reward,
    newRecord: total > old.bestTotal,
    englishRecord: english > old.bestEnglish,
    finishedAt: now.toISOString(),
    answerDetails: r.answers,
  };
  credit(s, "finish:" + runId, reward, correct * 10 + 20, "finish");
  if (r.type === "standard")
    s.stageBest[key] = {
      bestEnglish: Math.max(old.bestEnglish, english),
      bestTotal: Math.max(old.bestTotal, total),
      bestStars: Math.max(old.bestStars, st),
      paidStarMilestone: Math.max(old.paidStarMilestone, st),
      bestEnglishRunId:
        english > old.bestEnglish ? runId : old.bestEnglishRunId,
      bestTotalRunId: total > old.bestTotal ? runId : old.bestTotalRunId,
    };
  r.status = "completed";
  s.results[runId] = result;
  const day = dateKey(now),
    week = weekKey(now);
  const cal = (s.calendar[day] ??= {
    completedRuns: 0,
    correctCount: 0,
    studyDay: true,
  });
  cal.completedRuns++;
  cal.correctCount += correct;
  if (s.meta.lastStudyDate !== day) {
    const yesterday = new Date(day + "T00:00:00Z");
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    s.meta.streak =
      s.meta.lastStudyDate === yesterday.toISOString().slice(0, 10)
        ? s.meta.streak + 1
        : 1;
    s.meta.lastStudyDate = day;
  }
  for (const [period, scope] of [
    [day, "daily"],
    [week, "weekly"],
  ] as const) {
    progress(s, period, "correctAnswers", correct, scope);
    if (r.type === "standard") {
      progress(s, period, "standardStagesCompleted", 1, scope);
      if (st === 3)
        progress(s, period, "threeStarStandardCompletions", 1, scope);
    }
  }
  return result;
}
export function login(s: State, now = new Date()) {
  if (!s.profile.onboardingComplete) throw Error("初回設定が必要です");
  const day = dateKey(now);
  if (day <= s.meta.lastClaimDate) return;
  credit(s, "login:" + day, 50, 0, "login");
  s.meta.lastClaimDate = day;
}
export function reviewExample(s: State, id: string, now = new Date()) {
  const k = dateKey(now) + ":D-REVIEW";
  const m = (s.missions[k] ??= {
    progress: 0,
    claimed: false,
    reviewedExampleIds: [],
  });
  if (!m.reviewedExampleIds.includes(id)) {
    m.reviewedExampleIds.push(id);
    m.progress = m.reviewedExampleIds.length;
  }
}
export function claim(s: State, id: string, now = new Date()) {
  const def = [...rules.missions.daily, ...rules.missions.weekly].find(
    (m) => m.id === id,
  );
  if (!def) throw Error("ミッションがありません");
  const period = id.startsWith("D") ? dateKey(now) : weekKey(now);
  const key = period + ":" + id;
  const m = s.missions[key];
  if (!m || m.claimed || m.progress < def.target) return;
  credit(s, "mission:" + key, def.reward, 0, "mission");
  m.claimed = true;
}
