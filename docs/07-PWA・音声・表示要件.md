# iPhone横画面PWA要件

## ブラウザーに依存する部分の扱い

manifestはdisplay=standalone、orientation=landscape、lang=ja、name=Mrs. English、short_name=Mrs. English。orientation指定やscreen.orientation.lockだけでiPhoneの強制横固定が成立すると決めつけない。APIは機能検出し、利用できない/拒否時は回転案内を出す。portraitメディアクエリで学習UIを隠し安全に停止する。OS回転ロック解除を強制しない。

viewport-fit=cover、safe-area-inset-*、100dvh、スクロール可能領域を組み合わせる。body全体のtouch-action:noneは避け、タップUIにtouch-action:manipulation、ブロックバンクはpan-y。ダブルタップ誤ズームを抑えつつ、文字拡大やアクセシビリティを不必要に禁止しない。HTMLの文字と数値を描き、スクリーンショット1枚を全面に置いて偽UIにしない。

初回オンライン起動→教材/主要UI/全写真をキャッシュ→manifestのハッシュ照合→「オフライン準備完了」。通信途絶時は完了したファイルだけ維持し再試行。キャッシュ版はcontentVersion単位、全ファイル検証後に切替。未完の新版へ自動切替しない。Service Worker更新時にIndexedDBを消さない。HTTPSまたは開発localhost。CDNからの実行時フォント・教材取得は禁止し、必要資産を同一オリジンへ同梱。

WebKitの保存は容量・削除の影響を受けるため、Storage APIのpersist/persistedは機能検出して要求し、保証扱いしない。定期的なバックアップ案内、保存エラー表示、エクスポートを実装する。アプリ再インストール・ブラウザーデータ消去で端末データが消えることを設定画面に短く表示。

## フォント・画像

判定/数字の候補フォントBarlow Condensed Bold/BoldItalicをassets/fontsへOFLライセンスと出典付きで同梱。日本語はHiragino Sans、Noto Sans JPがある場合はその順、sans-serif。フォントの欠落で枠からはみ出さない。文字ロゴはassets/new/judgment-wordmarks.pngや承認済み語を参照し、表示文字は実フォントでも再現可能。

元写真122点は原寸保持しSHA256を付けている。Codexは配信用に複製からWebP等へ変換してよいが原本を上書きしない。幅は背景2532px以下、カード詳細1060px以下、サムネイル320pxを目安。ピクセル数だけで品質を判断せず、低解像度元写真は無理に超解像しない。カード枠の中に写真を切り抜き、顔の中央寄りをobjectPositionで調整する。

## 音声・効果音

読み上げは質問本文600件の端末TTSを基本、オフライン対応はローカルvoiceの実機検証とフォールバックを仕様化。音声入力や声の採点は今回作らない。効果音はassets/new/sfxに用意する短いUI音を初期音として使用し、初期ON・設定でOFF。最初のタップでAudioContextを有効化。バックグラウンド化で停止、音量は0.25を標準、同時最大4音。BGMは初期なし、将来差替え用の独立チャンネルを設ける。実在曲をBGMとして無断で自動同梱しない。

## 実機受入

横667×375、812×375、844×390、852×393以上を検証。Safariタブとホーム画面追加後を別に確認。縦持ち・左右回転・ホームインジケータ・ダークモード・文字拡大・省電力・通信断・機内モードでのTTS・音のミュート・カード79枚一覧のメモリー使用を確認する。机上のテストをiPhone実機検証済みと記録しない。

## 根拠資料（2026-10-27確認）

- [文部科学省・中学校外国語編](https://www.mext.go.jp/content/20210531-mxt_kyoiku01-100002608_010.pdf):中学校の言語材料・文法範囲。
- [MDN ScreenOrientation.lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock):対応と制約があるためフォールバックを設計。
- [MDN SpeechSynthesisVoice.localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService):ローカル音声かの判定。
- [WebKitのストレージポリシー](https://webkit.org/blog/14403/updates-to-storage-policy/):容量と永続化要求の扱い。
- [Google Fonts公式Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed):同梱TTFとOFL。ファイルの取得元・SHA256はassets/fonts/sources.json。
