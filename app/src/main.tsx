import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  cards,
  cardMap,
  backgrounds,
  members,
  curriculum,
  questionMap,
  exampleMap,
  rules,
  publicAsset,
} from "./content";
import {
  type State,
  type Run,
  type Difficulty,
  fresh,
  nicknameValid,
  entitle,
  openPack,
  upgrade,
  equip,
  recommend,
  startRun,
  answer,
  finish,
  login,
  reviewExample,
  claim,
  dateKey,
  weekKey,
  teamBonus,
  bonus,
  cost,
  uuid,
} from "./engine";
import {
  load,
  mutate,
  backup,
  parseBackup,
  replace,
  recoveryBackup,
} from "./db";
import "./style.css";
const img = (p: string) => publicAsset(p);
const memberName = (id: string) =>
  members.find((m) => m.id === id)?.nameJa ?? "";
const back = "assets/original/assets/card-frame/カードバック.png";
function Card({
  id,
  level = 1,
  unknown = false,
  onClick,
  small = false,
}: {
  id: string;
  level?: number;
  unknown?: boolean;
  onClick?: () => void;
  small?: boolean;
}) {
  const c = cardMap[id];
  return (
    <button
      className={"card " + (small ? "small" : "") + " rank-" + c.rank}
      onClick={onClick}
      aria-label={unknown ? "未取得 " + c.nameJa : c.nameJa + " Lv." + level}
    >
      <div className="card-art">
        {unknown ? (
          <img src={img(back)} alt="未取得" />
        ) : (
          <>
            <img
              className="photo"
              src={img(small ? "assets/thumbs/" + c.id + ".jpg" : c.photoPath)}
              loading="lazy"
              decoding="async"
              alt={c.memberNameJa}
              style={{ objectPosition: c.portraitCrop.objectPosition }}
            />
            <img
              className="frame"
              src={img(c.framePath)}
              loading="lazy"
              decoding="async"
              alt=""
            />
            <span className="rank">{c.rank}</span>
            <span className="card-level">Lv.{level}</span>
          </>
        )}
      </div>
      <span className="card-name">{unknown ? "未取得" : c.memberNameJa}</span>
    </button>
  );
}
const Icon = ({ name }: { name: string }) => (
  <img
    className="icon"
    src={img("assets/new/native/icon-" + name + ".svg")}
    alt=""
  />
);
function Count({
  value,
  delay = 0,
  duration = 400,
  animate = false,
}: {
  value: number;
  delay?: number;
  duration?: number;
  animate?: boolean;
}) {
  const [display, setDisplay] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, delay, duration, animate]);
  return <>{display.toLocaleString()}</>;
}
function App() {
  const [s, setS] = useState<State | null>(null),
    [screen, setScreen] = useState("title"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState("オフライン準備中"),
    [notice, setNotice] = useState(""),
    [dialog, setDialog] = useState<{
      title: string;
      body: string;
      action: () => Promise<void>;
    } | null>(null);
  const [grammar, setGrammar] = useState("G01"),
    [difficulty, setDifficulty] = useState<Difficulty>("EASY"),
    [grade, setGrade] = useState(0),
    [filter, setFilter] = useState("all"),
    [rankFilter, setRankFilter] = useState("all"),
    [selected, setSelected] = useState(""),
    [packId, setPackId] = useState("WELCOME-V1"),
    [runId, setRunId] = useState(""),
    [reviewIndex, setReviewIndex] = useState(0),
    [step, setStep] = useState(0),
    [draftName, setDraftName] = useState(""),
    [draftMember, setDraftMember] = useState(""),
    [draftBg, setDraftBg] = useState("bg-01"),
    [judgment, setJudgment] = useState(""),
    [ready, setReady] = useState(false),
    [portrait, setPortrait] = useState(
      matchMedia("(orientation: portrait)").matches,
    ),
    [period, setPeriod] = useState<"daily" | "weekly">("daily"),
    [resultPlaying, setResultPlaying] = useState(false);
  const stateRef = useRef<State | null>(null),
    locked = useRef(false),
    channel = useRef<BroadcastChannel | null>(null),
    tabId = useRef(uuid()),
    activeTab = useRef(true),
    elapsed = useRef(0),
    last = useRef(performance.now()),
    audio = useRef<AudioContext | null>(null),
    soundSources = useRef(new Set<AudioBufferSourceNode>()),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const apply = (next: State) => {
    stateRef.current = next;
    setS(next);
  };
  const action = async <T,>(
    fn: (s: State) => T,
    quiet = false,
  ): Promise<T | undefined> => {
    if (!activeTab.current) {
      setError("別のタブで開かれました。この画面を再読み込みしてください。");
      return;
    }
    if (!quiet) setBusy(true);
    try {
      const res = await mutate(fn);
      apply(res.state);
      return res.value;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      if (!quiet) setBusy(false);
    }
  };
  const safe = (fn: () => Promise<unknown>) => {
    void fn().catch(() => {});
  };
  const sound = (name: string) => {
    if (!stateRef.current?.settings.soundEnabled) return;
    void fetch(img("assets/new/sfx/" + name + ".wav"))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then(async (b) => {
        audio.current ??= new AudioContext();
        await audio.current.resume();
        const source = audio.current.createBufferSource();
        source.buffer = await audio.current.decodeAudioData(b);
        if (document.hidden || soundSources.current.size >= 4) return;
        soundSources.current.add(source);
        source.onended = () => soundSources.current.delete(source);
        const gain = audio.current.createGain();
        gain.gain.value = 0.25;
        source.connect(gain).connect(audio.current.destination);
        source.start();
      })
      .catch(() => {});
  };
  useEffect(() => {
    load()
      .then((next) => {
        apply(next);
        if (next.meta.lastGrammarId) setGrammar(next.meta.lastGrammarId);
        if (next.meta.lastDifficulty) setDifficulty(next.meta.lastDifficulty);
        const r = Object.values(next.runs).find((r) => r.status === "active");
        if (r) {
          setRunId(r.id);
          elapsed.current = r.elapsed;
          safe(() =>
            action((s) => {
              s.runs[r.id].paused = true;
            }, true),
          );
        }
      })
      .catch((e) =>
        setError(
          "セーブを読み込めません。データは消去していません。" +
            (e as Error).message,
        ),
      );
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("mrs-english");
      channel.current = bc;
      bc.postMessage({ type: "opened", id: tabId.current });
      bc.onmessage = (e) => {
        if (e.data.id !== tabId.current && e.data.type === "opened") {
          activeTab.current = false;
          setError(
            "別のタブで開かれました。この画面は編集を停止しました。再読み込みしてください。",
          );
          setScreen("title");
          if ("speechSynthesis" in window) speechSynthesis.cancel();
        }
      };
    }
    return () => {
      channel.current?.close();
      timers.current.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) {
      setOffline("開発モード：オフライン保存なし");
      return;
    }
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data.type === "cache-progress")
        setOffline(`オフライン準備 ${e.data.done}/${e.data.total}`);
      if (e.data.type === "cache-ready") setOffline("✓ オフライン準備完了");
    });
    navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI), { scope: "./" })
      .then(async (reg) => {
        (reg.active ?? navigator.serviceWorker.controller)?.postMessage(
          "status",
        );
        reg.addEventListener("updatefound", () => {
          reg.installing?.addEventListener("statechange", () => {
            if (reg.installing?.state === "redundant")
              setOffline("キャッシュ失敗：設定から再試行");
          });
        });
      })
      .catch(() => setOffline("オフライン準備失敗：設定から再試行"));
  }, []);
  const pause = () => {
    const st = stateRef.current;
    const r = st && Object.values(st.runs).find((r) => r.status === "active");
    if (r && !r.paused) {
      elapsed.current += performance.now() - last.current;
      last.current = performance.now();
      safe(() =>
        action((s) => {
          const current = s.runs[r.id];
          if (
            current.status === "active" &&
            current.questionIndex === r.questionIndex
          ) {
            current.elapsed = elapsed.current;
            current.paused = true;
          }
        }, true),
      );
    }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    for (const source of soundSources.current) {
      try {
        source.stop();
      } catch {}
    }
    soundSources.current.clear();
    void audio.current?.suspend();
  };
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) pause();
    };
    const mq = matchMedia("(orientation: portrait)");
    const rotate = () => {
      setPortrait(mq.matches);
      pause();
    };
    document.addEventListener("visibilitychange", visibility);
    mq.addEventListener("change", rotate);
    const backHandler = () => {
      pause();
      if (
        stateRef.current &&
        Object.values(stateRef.current.runs).some((r) => r.status === "active")
      )
        setScreen("play");
      else setScreen("home");
      history.pushState({}, "", location.href);
    };
    history.pushState({}, "", location.href);
    window.addEventListener("popstate", backHandler);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      mq.removeEventListener("change", rotate);
      window.removeEventListener("popstate", backHandler);
    };
  }, []);
  const run = s?.runs[runId];
  const q = run ? questionMap[run.questionOrder[run.questionIndex]] : null;
  useEffect(() => {
    if (
      screen !== "play" ||
      !run ||
      run.paused ||
      run.status !== "active" ||
      portrait ||
      ready ||
      judgment
    )
      return;
    elapsed.current = run.elapsed;
    last.current = performance.now();
    const index = run.questionIndex;
    const interval = setInterval(() => {
      if (locked.current || document.hidden || !activeTab.current) return;
      const now = performance.now();
      elapsed.current += now - last.current;
      last.current = now;
      safe(() =>
        action((st) => {
          const r = st.runs[runId];
          if (r.status === "active" && r.questionIndex === index && !r.paused)
            r.elapsed = elapsed.current;
        }, true),
      );
    }, 250);
    return () => clearInterval(interval);
  }, [
    screen,
    run?.id,
    run?.questionIndex,
    run?.paused,
    portrait,
    ready,
    judgment,
  ]);
  useEffect(() => {
    if (screen !== "review" || !run?.answers[reviewIndex]) return;
    safe(() =>
      action(
        (st) => reviewExample(st, run.answers[reviewIndex].exampleId),
        true,
      ),
    );
  }, [screen, runId, reviewIndex]);
  const skipResult = () => {
    setResultPlaying(false);
    safe(() =>
      action((st) => {
        if (st.results[runId]) st.results[runId].animationComplete = true;
      }, true),
    );
  };
  useEffect(() => {
    if (
      screen !== "result" ||
      !stateRef.current?.results[runId] ||
      stateRef.current.results[runId].animationComplete
    ) {
      setResultPlaying(false);
      return;
    }
    setResultPlaying(true);
    const t = setTimeout(
      () => {
        setResultPlaying(false);
        safe(() =>
          action((st) => {
            if (st.results[runId]) st.results[runId].animationComplete = true;
          }, true),
        );
      },
      stateRef.current.settings.reduceMotion ? 100 : 3800,
    );
    return () => clearTimeout(t);
  }, [screen, runId]);
  const go = (to: string) => {
    setScreen(to);
    setFilter("all");
    setRankFilter("all");
    setSelected("");
    setError("");
  };
  const begin = async (id: string) => {
    setRunId(id);
    setScreen("play");
    setReady(true);
    timers.current.push(
      setTimeout(() => {
        setReady(false);
        safe(() =>
          action((st) => {
            if (st.runs[id].status === "active") {
              st.runs[id].paused =
                document.hidden ||
                matchMedia("(orientation: portrait)").matches;
              elapsed.current = st.runs[id].elapsed;
              last.current = performance.now();
            }
          }),
        );
      }, 700),
    );
  };
  const start = async (type: "standard" | "review" = "standard") => {
    const current = stateRef.current?.runs[runId];
    const replay = current && (screen === "result" || screen === "play");
    const r = await action((st) =>
      startRun(
        st,
        replay ? current.grammarId : grammar,
        replay ? current.difficulty : difficulty,
        type,
      ),
    );
    if (r) await begin(r.id);
  };
  const submit = async (input: string[]) => {
    if (locked.current || !run || run.paused || judgment) return;
    locked.current = true;
    try {
      const total = elapsed.current + performance.now() - last.current;
      const a = await action((st) =>
        answer(st, runId, run.questionIndex, input, total),
      );
      if (!a) return;
      setJudgment(a.judgment);
      sound(a.correct ? "correct" : "miss");
      timers.current.push(
        setTimeout(
          () => {
            safe(async () => {
              setJudgment("");
              const value = await action((st) => {
                const r = st.runs[runId];
                if (r.questionIndex === r.questionOrder.length)
                  return finish(st, runId);
                r.paused =
                  document.hidden ||
                  matchMedia("(orientation: portrait)").matches;
                return null;
              });
              elapsed.current = 0;
              last.current = performance.now();
              if (value) setScreen("result");
            });
          },
          a.correct ? 700 : 900,
        ),
      );
    } finally {
      locked.current = false;
    }
  };
  const saveInput = async (input: string[]) => {
    if (!run || run.paused || locked.current) return;
    const i = run.questionIndex;
    await action((st) => {
      if (st.runs[runId].questionIndex === i) st.runs[runId].input = input;
    }, true);
  };
  const continueTitle = () => {
    if (!s) return;
    const unfinished = Object.values(s.packs).find(
      (p) => p.status !== "completed",
    );
    if (!s.profile.onboardingComplete) {
      setStep(s.profile.onboardingStep);
      setDraftName(s.profile.nickname);
      setDraftMember(s.profile.favoriteMemberId);
      setDraftBg(s.profile.homeBackgroundId);
      go("onboarding");
    } else if (unfinished) {
      setPackId(unfinished.id);
      go("pack");
    } else if (Object.values(s.runs).some((r) => r.status === "active")) {
      const r = Object.values(s.runs).find((r) => r.status === "active")!;
      setRunId(r.id);
      go("play");
    } else go("home");
    sound("confirm");
  };
  const welcomeNext = async () => {
    if (step === 0 && !nicknameValid(draftName)) {
      setError("ニックネームは改行なしの1〜12文字で入力してください");
      return;
    }
    await action((st) => {
      st.profile.nickname = draftName.trim();
      if (draftMember) st.profile.favoriteMemberId = draftMember;
      st.profile.onboardingStep = step + 1;
    });
    setStep(step + 1);
  };
  const open = async (id: string, n = 10) => {
    await action((st) => openPack(st, id, n));
    setPackId(id);
    go("pack");
    sound("pack-open");
  };
  const ask = (title: string, body: string, fn: () => Promise<void>) =>
    setDialog({ title, body, action: fn });
  const download = async (state: State, prefix = "mrs-english-backup") => {
    const b = await backup(state);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(b)], { type: "application/json" }),
    );
    a.download =
      prefix + "-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };
  const importFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024)
      throw Error("20MB以下のファイルを選んでください");
    const next = await parseBackup(await file.text());
    ask(
      "バックアップを復元",
      `${next.profile.nickname} / ${next.wallet.rp} RP / カード${Object.keys(next.ownedCards).length}枚。現在のデータを自動バックアップして全置換します。過去の状態に戻ります。`,
      async () => {
        await download(stateRef.current!, "mrs-english-before-restore");
        await replace(next);
        location.reload();
      },
    );
  };
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) {
      setNotice(
        "この端末では読み上げを利用できません。英文で学習を続けられます。",
      );
      return;
    }
    speechSynthesis.cancel();
    const voices = speechSynthesis
      .getVoices()
      .filter((v) => v.lang.startsWith("en"));
    const voice =
      voices.find((v) => v.localService) ??
      (navigator.onLine ? voices[0] : undefined);
    if (!voice) {
      setNotice(
        "英語の端末音声がありません。iPhoneの設定で英語の音声をダウンロードしてください。",
      );
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = s!.settings.ttsRate;
    u.onerror = () =>
      setNotice("音声を再生できません。英文で学習を続けられます。");
    speechSynthesis.speak(u);
  };
  if (!s)
    return (
      <div className="loading">
        <h1>Mrs. English</h1>
        <p>{error || "セーブデータを読み込んでいます…"}</p>
        {error && (
          <button
            onClick={() =>
              safe(async () => {
                await download(await load(false), "mrs-english-recovery");
              })
            }
          >
            元データをバックアップ
          </button>
        )}
      </div>
    );
  const bg =
    screen === "title"
      ? "assets/original/assets/photos/backgrounds/TOP.jpg"
      : backgrounds.find(
          (b) =>
            b.id ===
            (screen === "play"
              ? run?.backgroundId
              : s.profile.homeBackgroundId),
        )!.path;
  const result = s.results[runId];
  const pack = s.packs[packId];
  const missionDefs = rules.missions[period];
  const key = period === "daily" ? dateKey() : weekKey();
  const team = (
    <div className="team">
      {members.map((m) =>
        s.team[m.id] ? (
          <Card
            key={m.id}
            id={s.team[m.id]}
            level={s.ownedCards[s.team[m.id]].level}
            small
            onClick={() => {
              setSelected(s.team[m.id]);
              setScreen("cards");
            }}
          />
        ) : (
          <div key={m.id} className="empty">
            {m.nameJa}
            <br />
            空枠 0%
          </div>
        ),
      )}
    </div>
  );
  let body: React.ReactNode;
  if (screen === "title")
    body = (
      <div className="title" onClick={continueTitle}>
        <div className="title-logo">
          <span>PLAY. LEARN. SHINE.</span>
          <h1>
            Mrs.
            <br />
            <em>English</em>
          </h1>
          <p>好きが、英語の力になる。</p>
        </div>
        <button
          className="start title-start"
          onClick={(e) => {
            e.stopPropagation();
            continueTitle();
          }}
          disabled={busy}
        >
          TAP TO START <b>〉</b>
        </button>
        <small>60文法 · 600例文 · 無制限プレイ　 /　v1.0.0</small>
      </div>
    );
  else if (screen === "onboarding")
    body = (
      <section className="onboarding panel">
        <div className="eyebrow">WELCOME / STEP {step + 1} OF 4</div>
        {step === 0 ? (
          <>
            <h2>あなたの名前を教えてください</h2>
            <p>
              一緒に、英語を楽しもう。<small>例文は学習用の創作です。</small>
            </p>
            <input
              aria-label="ニックネーム"
              value={draftName}
              placeholder="ニックネーム（1〜12文字）"
              onChange={(e) => setDraftName(e.target.value)}
            />
          </>
        ) : step === 1 ? (
          <>
            <h2>推しメンバーを選ぼう</h2>
            <div className="members">
              {members.map((m) => (
                <Card
                  key={m.id}
                  id={
                    cards.find((c) => c.memberId === m.id && c.rank === "R")!.id
                  }
                  onClick={() => setDraftMember(m.id)}
                />
              ))}
            </div>
            <p>
              {draftMember
                ? "✓ " + memberName(draftMember)
                : "メンバーをタップしてください"}
              　<span className="muted">後から変更可・排出率は全員同じ</span>
            </p>
          </>
        ) : step === 2 ? (
          <>
            <h2>このメンバーに決定しますか？</h2>
            <h3>{memberName(draftMember)}</h3>
            <p>ホームの背景を次に選びます。</p>
          </>
        ) : (
          <>
            <h2>ホーム背景を選ぼう</h2>
            <div className="background-picker">
              {backgrounds.map((b) => (
                <button
                  key={b.id}
                  className={draftBg === b.id ? "chosen" : ""}
                  onClick={() => setDraftBg(b.id)}
                >
                  <img
                    src={img("assets/thumbs/" + b.id + ".jpg")}
                    loading="lazy"
                    alt={b.labelJa}
                  />
                  <span>{b.labelJa}</span>
                </button>
              ))}
            </div>
            <img
              className="bg-preview"
              src={img(backgrounds.find((b) => b.id === draftBg)!.path)}
              alt="選択中の背景"
            />
          </>
        )}
        <div className="actions">
          {step > 0 && <button onClick={() => setStep(step - 1)}>戻る</button>}
          <button
            className="primary"
            disabled={busy || (step === 1 && !draftMember)}
            onClick={() =>
              safe(async () => {
                if (step < 3) await welcomeNext();
                else {
                  await action((st) => {
                    st.profile.homeBackgroundId = draftBg;
                    entitle(st);
                  });
                  setPackId("WELCOME-V1");
                  go("pack");
                }
              })
            }
          >
            {step === 3 ? "この背景に決定" : step === 1 ? "選択を確認" : "決定"}
          </button>
        </div>
      </section>
    );
  else if (screen === "pack")
    body = (
      <section className="pack-screen">
        <div className="eyebrow">
          {pack?.source === "welcome" ? "WELCOME BONUS" : "CARD PACK"}
        </div>
        {pack?.status === "entitled" ? (
          <>
            <h2>初回特典！カード10枚パックをプレゼント！</h2>
            <img className="pack-back" src={img(back)} alt="カードパック" />
            <p>各メンバー1枚以上を保証 · 無料</p>
            <button
              className="primary"
              disabled={busy}
              onClick={() => safe(() => open(packId))}
            >
              開封する
            </button>
          </>
        ) : pack && pack.cursor < pack.draws.length ? (
          <>
            <h2>
              新しい出会いを、あなたに。{" "}
              <span>
                {pack.cursor + 1}/{pack.draws.length}
              </span>
            </h2>
            <Card
              id={pack.draws[pack.cursor].cardId}
              level={s.ownedCards[pack.draws[pack.cursor].cardId].level}
            />
            <p>
              {pack.draws[pack.cursor].duplicate
                ? "重複 → " + pack.draws[pack.cursor].rp + " RP還元（付与済み）"
                : "NEW CARD · 入手"}
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                safe(() =>
                  action((st) => {
                    st.packs[packId].cursor = Math.min(
                      st.packs[packId].cursor + 1,
                      st.packs[packId].draws.length,
                    );
                  }),
                )
              }
            >
              次へ
            </button>
            <button
              onClick={() =>
                safe(() =>
                  action((st) => {
                    st.packs[packId].cursor = st.packs[packId].draws.length;
                  }),
                )
              }
            >
              一覧へ
            </button>
          </>
        ) : (
          <>
            <h2>
              入手したカード <span>付与済み</span>
            </h2>
            <div className="pack-grid">
              {pack?.draws.map((d: any, i: number) => (
                <div key={i}>
                  <Card
                    id={d.cardId}
                    small
                    level={s.ownedCards[d.cardId].level}
                  />
                  <small>{d.duplicate ? `重複 +${d.rp} RP` : "NEW"}</small>
                </div>
              ))}
            </div>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                safe(async () => {
                  await action((st) => {
                    st.packs[packId].status = "completed";
                  });
                  go(pack.source === "welcome" ? "home" : "shop");
                })
              }
            >
              受取済み・{pack?.source === "welcome" ? "ホーム" : "ショップ"}へ
            </button>
          </>
        )}
      </section>
    );
  else if (screen === "home")
    body = (
      <div className="home">
        <div className="home-left">
          <div className="event panel">
            <div className="eyebrow">TODAY'S LESSON</div>
            <h2>
              今日も10問、
              <br />
              英語を楽しもう。
            </h2>
            <p>好きなペースで、何度でも。</p>
            <span className="diamonds">◆ ◇ ◇ ◇ ◇</span>
          </div>
          <button className="tile" onClick={() => go("login")}>
            <Icon name="gift" />
            <span>
              ログイン
              <br />
              ボーナス
            </span>
            <b>〉</b>
            {s.meta.lastClaimDate < dateKey() && <i>N</i>}
          </button>
        </div>
        <div className="home-right">
          <button className="tile" onClick={() => go("records")}>
            <Icon name="calendar" />
            <span>学習記録</span>
            <b>〉</b>
          </button>
          <button className="tile" onClick={() => go("review-list")}>
            <Icon name="replay" />
            <span>
              苦手問題の
              <br />
              復習
            </span>
            <b>〉</b>
          </button>
          {Object.values(s.runs).some((r) => r.status === "active") && (
            <button
              className="primary"
              onClick={() => {
                const r = Object.values(s.runs).find(
                  (r) => r.status === "active",
                )!;
                setRunId(r.id);
                go("play");
              }}
            >
              中断中の学習を再開
            </button>
          )}
        </div>
      </div>
    );
  else if (screen === "grammar")
    body = (
      <section className="panel stage">
        <div className="section-title">
          <div>
            <span className="eyebrow">CHOOSE YOUR STAGE</span>
            <h2>文法を選ぼう</h2>
          </div>
          <div className="tabs">
            {(["EASY", "NORMAL", "HARD"] as Difficulty[]).map((d) => (
              <button
                key={d}
                className={difficulty === d ? "chosen" : ""}
                onClick={() => setDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <select
            aria-label="学年"
            value={grade}
            onChange={(e) => setGrade(+e.target.value)}
          >
            <option value={0}>すべての学年</option>
            {[1, 2, 3].map((g) => (
              <option key={g} value={g}>
                中学{g}年
              </option>
            ))}
          </select>
        </div>
        <div className="stage-grid">
          {curriculum
            .filter((g) => !grade || g.suggestedGrade === grade)
            .map((g) => {
              const best = s.stageBest[g.id + ":" + difficulty];
              return (
                <button
                  key={g.id}
                  className={"lesson " + (g.id === grammar ? "chosen" : "")}
                  onClick={() => setGrammar(g.id)}
                >
                  <small>
                    {String(g.sequence).padStart(2, "0")} / 中学
                    {g.suggestedGrade}年
                  </small>
                  <strong>{g.nameJa}</strong>
                  <span className="stars">
                    {"★".repeat(best?.bestStars ?? 0)}
                    {"☆".repeat(3 - (best?.bestStars ?? 0))}
                  </span>
                  <small>
                    英語 {best?.bestEnglish ?? "—"} / TOTAL{" "}
                    {best?.bestTotal ?? "—"}
                  </small>
                </button>
              );
            })}
        </div>
        <div className="stage-footer">
          <span>
            {curriculum.find((g) => g.id === grammar)?.learningGoalJa}
          </span>
          <button className="start" onClick={() => go("stage-confirm")}>
            START 〉
          </button>
        </div>
      </section>
    );
  else if (screen === "stage-confirm")
    body = (
      <section className="panel confirm">
        <span className="eyebrow">STAGE READY</span>
        <h2>{curriculum.find((g) => g.id === grammar)?.nameJa}</h2>
        <p>{difficulty} · 10問 · プレイ回数無制限</p>
        {team}
        <p>
          カードボーナス +
          {(
            teamBonus(
              Object.values(s.team).map((id) => ({
                id,
                level: s.ownedCards[id].level,
              })),
            ) * 100
          ).toFixed(2)}
          %　空枠は0%
        </p>
        <div className="actions">
          <button onClick={() => go("cards")}>編成する</button>
          <button onClick={() => go("grammar")}>戻る</button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => safe(() => start())}
          >
            開始する
          </button>
        </div>
      </section>
    );
  else if (screen === "play" && run) {
    body = (
      <div className="game">
        <header className="game-hud">
          <button aria-label="一時停止" onClick={pause}>
            Ⅱ
          </button>
          <span>
            英語スコア{" "}
            <b>
              {run.answers
                .reduce((n, a) => n + a.accuracy + a.speed, 0)
                .toLocaleString()}
            </b>
          </span>
          <span>
            {run.type === "review"
              ? "苦手問題の復習"
              : curriculum.find((g) => g.id === run.grammarId)?.nameJa}{" "}
            <small>{q?.difficulty}</small>
          </span>
          <strong>
            Q {Math.min(run.questionIndex + 1, run.questionOrder.length)} /{" "}
            {run.questionOrder.length}
          </strong>
        </header>
        {q ? (
          <section className="question panel">
            <div className="question-heading">
              {q.difficulty === "EASY"
                ? "日本語の文に合う語を選びましょう"
                : "日本語の文に合うように、正しい語を並べましょう"}
            </div>
            <h2>{q.translationJa}</h2>
            {q.difficulty === "EASY" ? (
              <>
                <div className="english-prompt">{q.data.prompt}</div>
                <div className="options">
                  {run.optionOrders[run.questionIndex].map((id) => (
                    <button
                      key={id}
                      disabled={!!judgment || run.paused || ready}
                      onClick={() => safe(() => submit([id]))}
                    >
                      {q.data.options.find((o: any) => o.id === id).text}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="answer-rail" aria-label="解答レール">
                  {run.input.length ? (
                    run.input.map((id) => (
                      <button
                        key={id}
                        disabled={run.paused || !!judgment}
                        onClick={() =>
                          safe(() =>
                            saveInput(run.input.filter((x) => x !== id)),
                          )
                        }
                      >
                        {q.data.blocks.find((b: any) => b.id === id).text}
                      </button>
                    ))
                  ) : (
                    <span>下のブロックをタップして文を作ろう</span>
                  )}
                </div>
                <div className="bank">
                  {run.optionOrders[run.questionIndex]
                    .filter((id) => !run.input.includes(id))
                    .map((id) => (
                      <button
                        key={id}
                        disabled={run.paused || !!judgment}
                        onClick={() =>
                          safe(() => saveInput([...run.input, id]))
                        }
                      >
                        {q.data.blocks.find((b: any) => b.id === id).text}
                      </button>
                    ))}
                </div>
              </>
            )}
            <div className="game-bottom">
              <span
                className={
                  run.elapsed >= q.baseTimeSeconds * 1000 ? "time-up" : "timer"
                }
              >
                {run.elapsed >= q.baseTimeSeconds * 1000
                  ? "TIME UP · 速度点0 / 回答できます"
                  : `◷ ${Math.max(0, q.baseTimeSeconds - run.elapsed / 1000).toFixed(1)}秒`}
              </span>
              {q.difficulty !== "EASY" && (
                <>
                  <button onClick={() => setNotice(q.data.instructionJa)}>
                    語順のヒント
                  </button>
                  <button
                    disabled={run.paused || !run.input.length}
                    onClick={() =>
                      safe(() => saveInput(run.input.slice(0, -1)))
                    }
                  >
                    もどす
                  </button>
                  <button
                    disabled={run.paused || !run.input.length}
                    onClick={() => safe(() => saveInput([]))}
                  >
                    全解除
                  </button>
                  <button
                    className="primary"
                    disabled={
                      run.paused ||
                      !!judgment ||
                      run.input.length !== q.data.correctOrder.length
                    }
                    onClick={() => safe(() => submit(run.input))}
                  >
                    決定
                  </button>
                </>
              )}
            </div>
          </section>
        ) : (
          <button
            className="primary"
            onClick={() =>
              safe(async () => {
                await action((st) => finish(st, runId));
                go("result");
              })
            }
          >
            結果を確認
          </button>
        )}
        {judgment && (
          <div className={"judgment " + (judgment === "MISS" ? "miss" : "")}>
            {judgment}
          </div>
        )}
        {ready && <div className="ready">READY</div>}
        {run.paused && !judgment && !ready && (
          <div className="scrim">
            <section className="dialog">
              <span className="eyebrow">PAUSED</span>
              <h2>一時停止</h2>
              <p>問題・入力・経過時間は保存されています。</p>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    safe(async () => {
                      if (run.questionIndex === run.questionOrder.length) {
                        await action((st) => finish(st, runId));
                        go("result");
                      } else
                        await action((st) => {
                          st.runs[runId].paused = false;
                          elapsed.current = st.runs[runId].elapsed;
                          last.current = performance.now();
                        });
                    })
                  }
                >
                  再開
                </button>
                <button
                  onClick={() =>
                    ask(
                      "最初からやり直しますか？",
                      "途中のセット報酬は受け取れません。",
                      async () => {
                        await action((st) => {
                          st.runs[runId].status = "abandoned";
                        });
                        await start(run.type);
                      },
                    )
                  }
                >
                  最初から
                </button>
                <button
                  onClick={() =>
                    ask(
                      "学習を終了しますか？",
                      "途中のセット報酬は受け取れません。",
                      async () => {
                        await action((st) => {
                          st.runs[runId].status = "abandoned";
                        });
                        go("home");
                      },
                    )
                  }
                >
                  ホーム
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    );
  } else if (screen === "result" && result && run)
    body = (
      <section
        className={"panel results " + (resultPlaying ? "revealing" : "")}
        onClick={() => {
          if (resultPlaying) skipResult();
        }}
      >
        <div className="section-title">
          <span className="eyebrow">
            {run.type === "review" ? "REVIEW RESULT" : "STAGE RESULT"}
          </span>
          <h2>
            {curriculum.find((g) => g.id === run.grammarId)?.nameJa ??
              "苦手問題の復習"}
          </h2>
        </div>
        <div className="result-grid">
          <div>
            {team}
            <p>
              開始時カードボーナス
              <br />
              <b>+{(teamBonus(run.teamSnapshot) * 100).toFixed(2)}%</b>
            </p>
          </div>
          <div className="score-breakdown">
            <p>
              正確性{" "}
              <b>
                <Count
                  value={result.accuracy}
                  delay={250}
                  animate={resultPlaying}
                />
              </b>
            </p>
            <p>
              スピード{" "}
              <b>
                <Count
                  value={result.speed}
                  delay={700}
                  animate={resultPlaying}
                />
              </b>
            </p>
            <p>
              英語スコア <b>{result.english.toLocaleString()}</b>
            </p>
            <p>
              正解数{" "}
              <b>
                {result.correctCount}/{run.questionOrder.length}
              </b>
            </p>
          </div>
          <div className="total">
            <small>TOTAL SCORE</small>
            <strong>
              <Count
                value={result.total}
                delay={1700}
                duration={650}
                animate={resultPlaying}
              />
            </strong>
            {run.type === "standard" && (
              <span className="stars">
                {"★".repeat(result.stars)}
                {"☆".repeat(3 - result.stars)}
              </span>
            )}
            {result.newRecord && run.type === "standard" && (
              <em>NEW RECORD!</em>
            )}
            <p>
              獲得 <b>+{result.rp} RP</b>
            </p>
            <small>
              正解 {result.correctCount * 10} ＋ 完了50 ＋ 星{result.starRP}
            </small>
          </div>
        </div>
        <div className="actions">
          <button
            disabled={resultPlaying}
            onClick={() => {
              setReviewIndex(0);
              go("review");
            }}
          >
            レビュー
          </button>
          <button
            disabled={resultPlaying}
            onClick={() => safe(() => start(run.type))}
          >
            もう一度
          </button>
          <button
            className="primary"
            disabled={resultPlaying}
            onClick={() =>
              go(run.type === "review" ? "review-list" : "grammar")
            }
          >
            戻る
          </button>
        </div>
      </section>
    );
  else if (screen === "review" && run) {
    const a = run.answers[reviewIndex],
      e = exampleMap[a.exampleId];
    body = (
      <section className="panel review">
        <aside>
          <h2>回答レビュー</h2>
          <div className="review-list">
            {run.answers.map((a, i) => (
              <button
                key={i}
                className={reviewIndex === i ? "chosen" : ""}
                onClick={() => setReviewIndex(i)}
              >
                {i + 1}{" "}
                <span className={a.correct ? "correct" : "wrong"}>
                  {a.correct ? "✓ 正解" : "× 不正解"}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <article>
          <div className="eyebrow">
            QUESTION {reviewIndex + 1} / {run.answers.length}
          </div>
          <small>例文は学習用の創作です。</small>
          <h2>{e.translationJa}</h2>
          <p className="muted">
            あなたの回答：{a.text || "（未入力）"}
            {a.elapsed >= questionMap[a.questionId].baseTimeSeconds * 1000 &&
              " / 基準時間超過・速度点0"}
          </p>
          <h3 className="canonical">{e.english}</h3>
          <p>{e.sentenceExplanationJa}</p>
          <div className="glossary">
            {e.glossary.map((g: any, i: number) => (
              <span key={i}>
                <b>{g.expression}</b> {g.meaningJa}
              </span>
            ))}
          </div>
          <button onClick={() => speak(e.english)}>▶ 音声を再生</button>
        </article>
        <div className="actions">
          <button
            disabled={reviewIndex === 0}
            onClick={() => setReviewIndex(reviewIndex - 1)}
          >
            前の問題
          </button>
          <button
            disabled={reviewIndex === run.answers.length - 1}
            onClick={() => setReviewIndex(reviewIndex + 1)}
          >
            次の問題
          </button>
          <button className="primary" onClick={() => go("result")}>
            閉じる
          </button>
        </div>
      </section>
    );
  } else if (screen === "review-list")
    body = (
      <section className="panel list-screen">
        <div className="section-title">
          <div>
            <span className="eyebrow">PRACTICE MAKES PROGRESS</span>
            <h2>
              苦手問題の復習 <small>{Object.keys(s.mistakes).length}件</small>
            </h2>
          </div>
          <button
            className="primary"
            disabled={busy || !Object.keys(s.mistakes).length}
            onClick={() => safe(() => start("review"))}
          >
            最大10問を復習する
          </button>
        </div>
        <div className="scroll">
          {Object.entries(s.mistakes).map(([id, m]) => (
            <div className="row" key={id}>
              <span>
                {exampleMap[id].grammarNameJa} / {m.difficulty}
              </span>
              <span>{exampleMap[id].translationJa}</span>
            </div>
          ))}
          {!Object.keys(s.mistakes).length && (
            <div className="empty-state">
              <Icon name="check" />
              <h3>今は苦手問題がありません</h3>
              <p>間違えた問題がここに集まります。</p>
            </div>
          )}
        </div>
        <p className="muted">
          復習でもRPとXPを獲得できます。星・ベストは更新しません。
        </p>
      </section>
    );
  else if (screen === "cards" || screen === "collection") {
    const pool = cards.filter(
      (c) =>
        (screen === "collection" || s.ownedCards[c.id]) &&
        (filter === "all" || c.memberId === filter) &&
        (rankFilter === "all" || c.rank === rankFilter),
    );
    const c = selected ? cardMap[selected] : null;
    const owned = c ? s.ownedCards[c.id] : null;
    body = (
      <section className="panel collection">
        <div className="section-title">
          <div>
            <span className="eyebrow">
              {screen === "cards" ? "YOUR TEAM" : "PHOTO COLLECTION"}
            </span>
            <h2>
              {screen === "cards" ? "所持カード・編成" : "図鑑"}{" "}
              <small>{Object.keys(s.ownedCards).length}/79</small>
            </h2>
          </div>
          <select
            aria-label="メンバー絞り込み"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">全メンバー</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameJa}
              </option>
            ))}
          </select>
          <select
            aria-label="ランク絞り込み"
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value)}
          >
            <option value="all">全ランク</option>
            {["C", "B", "A", "S", "R"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          {screen === "cards" && (
            <button onClick={() => safe(() => action(recommend))}>
              おすすめ編成
            </button>
          )}
        </div>
        <div className="collection-body">
          <div className="card-grid">
            {pool.map((c) => (
              <Card
                key={c.id}
                id={c.id}
                small
                unknown={!s.ownedCards[c.id]}
                level={s.ownedCards[c.id]?.level}
                onClick={() => setSelected(c.id)}
              />
            ))}
          </div>
          <aside className="card-details">
            {c ? (
              <>
                <h3>{c.nameJa}</h3>
                {owned ? (
                  <>
                    <Card id={c.id} level={owned.level} />
                    <p>
                      Lv.{owned.level} /{" "}
                      {rules.ranks[c.rank as keyof typeof rules.ranks].maxLevel}
                      　+{(bonus(c.id, owned.level) * 100).toFixed(2)}%
                    </p>
                    <small>
                      入手日{" "}
                      {new Date(owned.obtainedAt).toLocaleDateString("ja-JP")}
                    </small>
                    <div className="actions">
                      <button
                        disabled={s.team[c.memberId] === c.id}
                        onClick={() =>
                          safe(() => action((st) => equip(st, c.id)))
                        }
                      >
                        {s.team[c.memberId] === c.id ? "編成中" : "編成する"}
                      </button>
                      <button
                        disabled={
                          owned.level >=
                          rules.ranks[c.rank as keyof typeof rules.ranks]
                            .maxLevel
                        }
                        onClick={() =>
                          ask(
                            "カードを強化",
                            `Lv.${owned.level} → ${owned.level + 1} / ${cost(owned.level)}RP。成功率100%。`,
                            async () => {
                              await action((st) =>
                                upgrade(st, c.id, "upgrade:" + uuid()),
                              );
                              sound("level-up");
                              setNotice("LEVEL UP!");
                            },
                          )
                        }
                      >
                        強化{" "}
                        {owned.level >=
                        rules.ranks[c.rank as keyof typeof rules.ranks].maxLevel
                          ? "MAX"
                          : cost(owned.level) + "RP"}
                      </button>
                    </div>
                    <div className="actions">
                      <button
                        onClick={() =>
                          safe(() =>
                            action((st) => {
                              st.ownedCards[c.id].favorite =
                                !st.ownedCards[c.id].favorite;
                            }),
                          )
                        }
                      >
                        {owned.favorite ? "♥ お気に入り" : "♡ お気に入り"}
                      </button>
                      <button
                        onClick={() =>
                          safe(() =>
                            action((st) => {
                              st.ownedCards[c.id].locked =
                                !st.ownedCards[c.id].locked;
                            }),
                          )
                        }
                      >
                        {owned.locked ? "🔒 ロック中" : "ロック"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <img
                      className="unknown-card"
                      src={img(back)}
                      alt="未取得"
                    />
                    <p>未取得</p>
                    <p>カードパックから入手できます。</p>
                  </>
                )}
              </>
            ) : (
              <>
                <h3>あなたの編成</h3>
                {team}
                <p>1メンバー1枚、最大3枚</p>
                <p>
                  チームボーナス +
                  {(
                    teamBonus(
                      Object.values(s.team).map((id) => ({
                        id,
                        level: s.ownedCards[id].level,
                      })),
                    ) * 100
                  ).toFixed(2)}
                  %
                </p>
                <p className="muted">カードをタップして、詳細・編成・強化</p>
              </>
            )}
          </aside>
        </div>
      </section>
    );
  } else if (screen === "shop")
    body = (
      <section className="panel shop">
        <span className="eyebrow">RP CARD SHOP</span>
        <h2>好きな一枚に、出会おう。</h2>
        <div className="shop-packs">
          {[1, 10].map((n) => (
            <div className="shop-pack" key={n}>
              <img src={img(back)} alt="カードパック" />
              <div>
                <h3>{n}枚パック</h3>
                <p>
                  {n === 1
                    ? "毎日の学習を、一枚の思い出に。"
                    : "10枚の新しい出会い。"}
                </p>
                <button
                  className="primary"
                  disabled={busy || s.wallet.rp < (n === 1 ? 1000 : 9000)}
                  onClick={() => {
                    const id = uuid();
                    ask(
                      "購入を確認",
                      `${n}枚 / ${n === 1 ? 1000 : 9000}RP を消費します。重複カードはRPに還元します。`,
                      () => open(id, n),
                    );
                  }}
                >
                  {n === 1 ? "1,000" : "9,000"} RP で購入
                </button>
                {s.wallet.rp < (n === 1 ? 1000 : 9000) && (
                  <small>
                    あと{" "}
                    {((n === 1 ? 1000 : 9000) - s.wallet.rp).toLocaleString()}{" "}
                    RP
                  </small>
                )}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => go("rates")}>排出率・重複還元について</button>
        <p className="muted">
          プレイ回数無制限。RPは学習とミッションで獲得できます。
        </p>
      </section>
    );
  else if (screen === "rates")
    body = (
      <section className="panel list-screen">
        <h2>カードの排出率</h2>
        <div className="scroll">
          {Object.entries(rules.rankWeights).map(([rank, p]) => (
            <div className="row" key={rank}>
              <strong>{rank} ランク</strong>
              <span>{p}%</span>
              <span>
                重複 →{" "}
                {rules.duplicateRP[rank as keyof typeof rules.duplicateRP]} RP
              </span>
            </div>
          ))}
          <p>
            各メンバーは等確率（1/3）。同メンバー・ランク内の画像は一様抽選です。
          </p>
          <p>
            通常10枚は独立抽選で、レア確定はありません。初回無料10枚だけ各メンバー1枚以上を保証します。
          </p>
        </div>
        <button onClick={() => go("shop")}>戻る</button>
      </section>
    );
  else if (screen === "missions")
    body = (
      <section className="panel missions">
        <div className="section-title">
          <div>
            <span className="eyebrow">A LITTLE EVERY DAY</span>
            <h2>ミッション</h2>
          </div>
          <div className="tabs">
            <button
              className={period === "daily" ? "chosen" : ""}
              onClick={() => setPeriod("daily")}
            >
              デイリー
            </button>
            <button
              className={period === "weekly" ? "chosen" : ""}
              onClick={() => setPeriod("weekly")}
            >
              週間
            </button>
          </div>
          <button
            onClick={() =>
              safe(() =>
                action((st) => {
                  for (const m of missionDefs) claim(st, m.id);
                }),
              )
            }
          >
            全部受取
          </button>
        </div>
        <p>日本時間・{period === "daily" ? "毎日0時" : "月曜0時"}更新</p>
        {missionDefs.map((m) => {
          const p = s.missions[key + ":" + m.id];
          const labels: Record<string, string> = {
            correctAnswers: "問題に正解する",
            standardStagesCompleted: "通常ステージを完了する",
            distinctReviewedExamples: "異なる問題のレビューを見る",
            threeStarStandardCompletions: "通常ステージで星3を獲得",
          };
          return (
            <div className="mission row" key={m.id}>
              <Icon name="mission" />
              <div>
                <strong>
                  {labels[m.metric]}　{m.target}
                  {m.id === "D-REVIEW" ? "問" : "回"}
                </strong>
                <progress
                  value={Math.min(p?.progress ?? 0, m.target)}
                  max={m.target}
                />
                <small>
                  {p?.progress ?? 0} / {m.target}
                </small>
              </div>
              <b>+{m.reward} RP</b>
              <button
                disabled={busy || p?.claimed || !(p?.progress >= m.target)}
                onClick={() => safe(() => action((st) => claim(st, m.id)))}
              >
                {p?.claimed ? "受取済み" : "受取"}
              </button>
            </div>
          );
        })}
      </section>
    );
  else if (screen === "login")
    body = (
      <section className="panel login">
        <Icon name="gift" />
        <span className="eyebrow">DAILY GIFT</span>
        <h2>今日のログインボーナス</h2>
        <strong>
          50 <small>RP</small>
        </strong>
        <p>毎日、日本時間0時更新。連続学習はセット完了で記録します。</p>
        <button
          className="primary"
          disabled={busy || s.meta.lastClaimDate >= dateKey()}
          onClick={() => safe(() => action((st) => login(st)))}
        >
          {s.meta.lastClaimDate >= dateKey() ? "受取済み" : "受取"}
        </button>
        <button onClick={() => go("home")}>戻る</button>
      </section>
    );
  else if (screen === "records")
    body = (
      <section className="panel list-screen">
        <div className="section-title">
          <div>
            <span className="eyebrow">YOUR LEARNING JOURNEY</span>
            <h2>学習記録</h2>
          </div>
          <span>
            学習 {Object.keys(s.calendar).length}日 /{" "}
            {Object.values(s.results).length}セット / 累積正解{" "}
            {Object.values(s.results).reduce((n, r) => n + r.correctCount, 0)}問
          </span>
        </div>
        <div className="scroll">
          {Object.values(s.results)
            .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
            .map((r) => (
              <button
                className="row history"
                key={r.runId}
                onClick={() => {
                  setRunId(r.runId);
                  setReviewIndex(0);
                  go("review");
                }}
              >
                <span>{new Date(r.finishedAt).toLocaleString("ja-JP")}</span>
                <strong>
                  {s.runs[r.runId].type === "review"
                    ? "苦手復習"
                    : curriculum.find((g) => g.id === s.runs[r.runId].grammarId)
                        ?.nameJa}
                </strong>
                <span>
                  {r.correctCount}問正解 / {r.total.toLocaleString()}点
                </span>
                <span className="stars">{"★".repeat(r.stars)}</span>
                <b>レビュー 〉</b>
              </button>
            ))}
          {!Object.keys(s.results).length && (
            <div className="empty-state">
              <h3>最初の10問から、はじめよう。</h3>
              <button className="primary" onClick={() => go("grammar")}>
                文法を選ぶ
              </button>
            </div>
          )}
        </div>
      </section>
    );
  else if (screen === "settings")
    body = (
      <section className="panel settings">
        <div className="section-title">
          <div>
            <span className="eyebrow">MAKE IT YOURS</span>
            <h2>メニュー・設定</h2>
          </div>
          <button onClick={() => go("backup")}>バックアップ</button>
        </div>
        <div className="settings-grid">
          <label>
            ニックネーム
            <input
              aria-label="名前を変更"
              defaultValue={s.profile.nickname}
              onBlur={(e) => {
                const n = e.target.value;
                if (nicknameValid(n))
                  safe(() =>
                    action((st) => {
                      st.profile.nickname = n.trim();
                    }),
                  );
                else setError("名前は改行なしの1〜12文字です");
              }}
            />
          </label>
          <label>
            推し
            <select
              value={s.profile.favoriteMemberId}
              onChange={(e) =>
                safe(() =>
                  action((st) => {
                    st.profile.favoriteMemberId = e.target.value;
                  }),
                )
              }
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nameJa}
                </option>
              ))}
            </select>
          </label>
          <label>
            ホーム背景
            <select
              value={s.profile.homeBackgroundId}
              onChange={(e) =>
                safe(() =>
                  action((st) => {
                    st.profile.homeBackgroundId = e.target.value;
                  }),
                )
              }
            >
              {backgrounds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.labelJa}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={s.settings.soundEnabled}
              onChange={(e) =>
                safe(() =>
                  action((st) => {
                    st.settings.soundEnabled = e.target.checked;
                  }),
                )
              }
            />{" "}
            効果音
          </label>
          <label>
            <input
              type="checkbox"
              checked={s.settings.reduceMotion}
              onChange={(e) =>
                safe(() =>
                  action((st) => {
                    st.settings.reduceMotion = e.target.checked;
                  }),
                )
              }
            />{" "}
            演出を軽減
          </label>
          <label>
            読み上げ速度 {s.settings.ttsRate}
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={s.settings.ttsRate}
              onChange={(e) =>
                safe(() =>
                  action((st) => {
                    st.settings.ttsRate = +e.target.value;
                  }),
                )
              }
            />
          </label>
          <label>
            写真の暗さ {Math.round(s.settings.photoOverlay * 100)}%
            <input
              type="range"
              min="0.4"
              max="0.7"
              step="0.05"
              value={s.settings.photoOverlay}
              onChange={(e) =>
                safe(() =>
                  action((st) => {
                    st.settings.photoOverlay = +e.target.value;
                  }),
                )
              }
            />
          </label>
        </div>
        <div className="settings-help">
          <button
            onClick={() =>
              safe(async () => {
                const kept = await navigator.storage?.persist?.();
                setNotice(
                  kept
                    ? "端末保存の保持が許可されました。定期的なバックアップもおすすめします。"
                    : "この端末では保持を保証できません。定期的にバックアップしてください。",
                );
              })
            }
          >
            端末保存の保持を要求
          </button>
          <p>
            {offline}{" "}
            <button
              onClick={() => {
                navigator.serviceWorker
                  ?.getRegistration()
                  .then((r) => r?.update());
                location.reload();
              }}
            >
              再試行
            </button>
          </p>
          <p>
            Safariの共有
            →「ホーム画面に追加」でアプリとして起動できます。横向きにしてご利用ください。横向き固定はiPhone側の制限があるため、縦向き時は学習を一時停止します。
          </p>
          <p>
            オフライン音声には端末の英語音声が必要です。利用できなくても文字で学習できます。端末データの消去でセーブが失われるため、定期的にバックアップしてください。
          </p>
        </div>
      </section>
    );
  else if (screen === "backup")
    body = (
      <section className="panel backup">
        <span className="eyebrow">KEEP YOUR MEMORIES SAFE</span>
        <h2>バックアップ・復元</h2>
        <button
          onClick={() =>
            safe(async () => {
              const b = await recoveryBackup();
              if (b) await download(b.payload, "mrs-english-before-restore");
              else setNotice("復元前の自動バックアップはまだありません");
            })
          }
        >
          復元前の自動バックアップを保存
        </button>
        <p>プロフィール、カード、RP、学習履歴をJSONファイルに保存します。</p>
        <button className="primary" onClick={() => safe(() => download(s))}>
          バックアップを保存
        </button>
        <label className="file-button">
          バックアップを読み込む
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                safe(async () => {
                  try {
                    await importFile(f);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                });
              e.target.value = "";
            }}
          />
        </label>
        <p>
          復元は検証後に全置換します。現在の状態を先に自動バックアップします。
          <br />
          20MB以下。破損・未対応版・未知ID・不正な残高やカードLvは受け付けません。
        </p>
        <button onClick={() => go("settings")}>戻る</button>
      </section>
    );
  else body = <button onClick={() => go("home")}>ホームへ</button>;
  const full = ["title", "play", "onboarding", "pack"].includes(screen);
  const nav = [
    ["cards", "cards", "カード"],
    ["collection", "book", "図鑑"],
    ["missions", "mission", "ミッション"],
    ["shop", "shop", "ショップ"],
    ["grammar", "play", "START"],
  ];
  return (
    <div
      onPointerDown={() => {
        if (s.settings.soundEnabled) {
          audio.current ??= new AudioContext();
          void audio.current.resume().catch(() => {});
        }
      }}
      className={"app " + (s.settings.reduceMotion ? "reduce-motion" : "")}
      style={
        {
          "--bg": `url("${img(bg)}")`,
          "--overlay": screen === "title" ? 0.2 : s.settings.photoOverlay,
        } as React.CSSProperties
      }
    >
      {!full && (
        <header className="status-bar">
          <button className="profile" onClick={() => go("home")}>
            <img
              src={img(
                cards.find(
                  (c) =>
                    c.memberId === s.profile.favoriteMemberId && c.rank === "R",
                )?.photoPath ?? cards[0].photoPath,
              )}
              alt="プロフィール"
            />
            <span>
              <strong>{s.profile.nickname}</strong>
              <small>推し {memberName(s.profile.favoriteMemberId)}</small>
            </span>
          </button>
          <span className="stat">
            ♛ <b>Lv.{Math.min(99, 1 + Math.floor(s.wallet.xp / 500))}</b>
          </span>
          <span className="stat">
            連続 <b>{s.meta.streak}日</b>
          </span>
          <span className="rp">
            Ⓡ <b>{s.wallet.rp.toLocaleString()}</b> RP
          </span>
          <button aria-label="メニュー・設定" onClick={() => go("settings")}>
            ☰
          </button>
        </header>
      )}
      <main className={full ? "full-main" : "main"}>{body}</main>
      {!full && (
        <nav className="bottom-nav">
          {nav.map(([to, icon, label]) => (
            <button
              key={to}
              className={
                (screen === to ? "active " : "") +
                (to === "grammar" ? "start" : "")
              }
              onClick={() => go(to)}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {to === "grammar" && <b>〉</b>}
            </button>
          ))}
        </nav>
      )}
      {error && (
        <div className="scrim" role="alertdialog">
          <section className="dialog">
            <h2>
              {activeTab.current ? "確認が必要です" : "別タブで開かれています"}
            </h2>
            <p>{error}</p>
            {activeTab.current ? (
              <>
                <button onClick={() => setError("")}>戻る・再試行</button>
                <button onClick={() => safe(() => download(stateRef.current!))}>
                  バックアップを保存
                </button>
              </>
            ) : (
              <button onClick={() => location.reload()}>再読み込み</button>
            )}
          </section>
        </div>
      )}
      {dialog && (
        <div className="scrim" role="dialog">
          <section className="dialog">
            <h2>{dialog.title}</h2>
            <p>{dialog.body}</p>
            <div className="actions">
              <button onClick={() => setDialog(null)}>キャンセル</button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => {
                  const d = dialog;
                  setDialog(null);
                  safe(d.action);
                }}
              >
                決定
              </button>
            </div>
          </section>
        </div>
      )}
      {notice && (
        <div className="scrim">
          <section className="dialog">
            <p>{notice}</p>
            <button onClick={() => setNotice("")}>閉じる</button>
          </section>
        </div>
      )}
      {portrait && (
        <div className="rotate">
          <Icon name="rotate" />
          <h2>端末を横向きにしてください</h2>
          <p>回転ロックを解除し、iPhoneを横向きにしてください。</p>
          <p>入力は保持され、プレイ時間は停止します。</p>
        </div>
      )}
      <div className="save-status" aria-live="polite">
        {busy
          ? "保存しています…"
          : offline.startsWith("✓")
            ? "端末に自動保存"
            : "端末に自動保存 · " + offline}
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
