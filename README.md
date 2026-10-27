# Mrs. English — Production Kit v2.0（横画面版）

作成日:2026-10-27。iPhone横画面、SUPERSTAR風の日本語英語学習ゲームの制作準備キットです。**アプリ本体は実装していません。** 後日Codexへ、このフォルダー全体を渡してください。

## 入っているもの

|成果物|場所|
|---|---|
|全ルール・計算・カード・報酬|docs/01-ゲーム仕様書.md / game-rules.json|
|中学英語60項目・学習目標|docs/02-文法60項目.md / questions/curriculum.json|
|600例文・和訳・解説・語彙|questions/examples.json / 教材全600例文.md|
|共通600例文×3難易度＝1800問|questions/questions.json / by-grammar/|
|読み上げ本文600件・ID・言語・速度|questions/tts-manifest.json|
|37画面状態の配置・遷移・日本語文言|docs/04-全画面UI設計書.md|
|元ZIP122素材のサイズ・実透過・用途・ハッシュ|docs/03-既存素材一覧.md / assets/catalogs/|
|元写真・カード枠・背景・ロゴ|assets/original/ / original-assets.zip|
|カード79定義・背景22定義・メンバー対応|assets/catalogs/cards.json / backgrounds.json / members.json|
|新規横画面イメージ9枚と判定語|assets/new/landscape-mockups/ / judgment-wordmarks.png|
|独立SVG31点・9-slice定義|assets/new/native/|
|オリジナルUI効果音9種WAV|assets/new/sfx/|
|表示用TTF・OFL|assets/fonts/|
|アニメーションの時間・順序・CSS|animations/|
|詳細実装指示・受入試験|codex-instructions/ / qa/受入テスト.md|
|機械検証結果・計算境界値|qa/validation-report.json / test-vectors.json|
|教材原稿・再生成ツール|authoring/|

## 仕様の優先順位

「横画面だった」という最新訂正を適用しています。本文に残った縦画面という語や、旧案のスタミナ・ダイヤ・ヘッドホンは今回の仕様ではありません。

1. docs/01とdocs/game-rules.jsonのゲーム仕様。
2. docs/04とdocs/05の画面・保存設計。
3. questions/の教材正本。
4. 生成画面は見た目の参照。画像内の誤字、サンプルの数値や構成を仕様として採用しない。

既存写真を最優先し、タイトル背景はTOP固定、ホーム選択とプレイ抽選はbg-01〜22のみ。新規モックの生成された顔を本番のカード写真へ置き換えない。

## 決定してある補足仕様

- 3枚編成は各メンバー1枚。C/B/A/S/Rの素材内訳を確認済み。
- 通常ランク確率C45/B30/A15/S8/R2%、メンバー等確率。初回無料10枚だけ各メンバー最低1枚。
- 重複カードはRP還元、Lvは維持。初回パック・購入・強化・報酬の原子トランザクションを明記。
- 基準時間超過でも回答続行。時間切れ後の正解は700点。星は正解数のみ。
- すべての単元は最初から開放。星・ベスト・初回星報酬は文法×難易度で独立。
- 日本時間の日・週境界、学習Lv、連続日数、ミッション集計、復習の件数と報酬を定義。
- バックアップは検証後の全置換。セーブと画像キャッシュを分離。

## 確認済み／実装時に確認すること

教材600件は執筆時に英文・和訳・対象文法を見直し、データの正解復元・参照・語彙・タイマーを全件検査しました。検査の範囲と修正事項はqa/教材点検記録.mdに記録しています。機械検査合格は、あらゆる自然な別語順の誤りやアプリ実機動作を証明するものではありません。

読み上げ本文は600件ありますが、**英語音声の録音ファイル600本は含みません**。端末TTSの利用設計です。効果音は9本同梱。iPhoneでの横向き対応・端末ローカルTTS・オフライン復元はCodex実装後の実機受入項目です。

動くアプリ、Webサーバー、Service Worker、端末テスト済みという成果物は含みません。新規画像の部品シートは必要に応じ切り出しますが、操作アイコンと基本枠は独立SVGも用意しています。PWAアイコン等の配信サイズ書出しは実装時の定型工程として指示済みです。

## 再生成と検証（Python標準ライブラリ）

このフォルダーをカレントディレクトリにして順に実行:

```text
python authoring/build_questions.py
python authoring/make_schemas.py
python authoring/validate_kit.py
```

questionsだけを直接書き換えずauthoring/lessons-*.txtの原稿を編集してください。標準JSON Schemaを用いた追加検証の結果もqaへ保存しています。再生成すると教材・QAは上書きされるため、配布版のコピーを使ってください。

## Codexに渡す文面

「Mrs-English-Production-Kitを参照して、iPhone横画面PWAを実装してください。まずcodex-instructions/01-実装指示書.mdを読み、教材とゲーム仕様を変えずに制作してください。元写真・UI素材を活用し、スコア・報酬・保存の受入試験を通してください。画像内の文字や数値より仕様書を優先してください。」

ファイル整合性はMANIFEST.sha256、ZIP全体のハッシュはZIP横の.sha256を参照してください。
