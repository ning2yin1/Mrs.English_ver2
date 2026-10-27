# Mrs. English 追加UI素材 v3

承認済みv2とreference内のゲームスクリーンショットを参照した追加画像案です。
内蔵image_genで生成。アプリへの実装・既存素材の置き換えは行っていません。

## フォルダーと用途

|フォルダー|ファイル|内容|
|---|---|---|
|01-panels|mission-reward-panels.png|未完了／完了ミッション、報酬表示、7日分の出席パネル|
|02-controls|progress-and-status.png|空／半分／完了のバー、分割バー、時間リング、コンボ／継続表示|
|02-controls|notifications-and-tags.png|成功／案内／警告／ロック通知、NEW・EVENT・DAILY・WEEKLY、通知／数量バッジ|
|02-controls|settings-and-selection.png|トグル、チェック、ラジオ、スライダー、ドロップダウン、選択タブ|
|03-icons|navigation-icons.png|ホーム、設定、カレンダー、時計、通知、メール、検索、絞込、お気に入り等|
|03-icons|study-and-collection-icons.png|発音、会話、筆記、単語、復習、成績、ギフト、カード、トロフィー等|
|04-effects|sparkles-and-clear-effects.png|きらめき、放射光、紙吹雪、光の線、選択リング|
|04-effects|collection-and-unlock-overlays.png|カード選択枠、金の枠、ロック、反射光、お気に入り、NEW|

## シートの読み方

各PNGは複数の部品を並べた素材シートです。個別ファイルへの切り出しは未実施です。
表記は左から右、上から下の順です。パネル・設定部品は文字を後載せするため空欄にしています。
アイコン2枚は確認しやすい青背景付きです。透過アイコンとしてそのまま使うものではありません。
そのほかのシートは透過指定で生成していますが、縁の半透明ピクセルや光彩も含まれます。
エフェクトは静止PNGです。動画、連番アニメーション、動作するUIは含みません。
比率・縁取り・線の太さは生成画像なので、実際に採用する段階で調整する前提です。

## 配置一覧

- mission-reward-panels: 2列×2段。未完了、完了、報酬、出席。
- progress-and-status: 2列×4段。空、半分、完了、分割、時間1/4、時間3/4、コンボ、継続。
- notifications-and-tags: 2列×5段。成功、案内、警告、ロック、NEW、EVENT、DAILY、WEEKLY、N、数量。
- settings-and-selection: 2列×5段。ON、OFF、チェック有、無、選択ラジオ、未選択ラジオ、通常スライダー、無効スライダー、ドロップダウン、タブ。
- navigation-icons: 4列×4段。ホーム、設定、カレンダー、時計／通知、メール、検索、絞込／ハート、ブックマーク、ロック、解除／ダウンロード、オフライン保存、案内、ヘルプ。
- study-and-collection-icons: 4列×4段。マイク、会話、鉛筆、単語カード／本、音声学習、復習、成績／ギフト、パック、カード一覧、トロフィー／ダイヤ、ポイント、継続、目標。
- sparkles-and-clear-effects: 3列×2段。単独の星、星の群れ、放射光／紙吹雪、光の線、選択リング。
- collection-and-unlock-overlays: 3列×2段。選択枠、金枠、ロック／反射光、お気に入り、NEW。

生成に使用した指示と参照ファイルはgeneration-manifest.jsonに保存しています。
