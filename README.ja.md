# XPremium Helper

[简体中文](README.md) · [English](README.en.md) · [Español](README.es.md) · [日本語](README.ja.md) · [Português (Brasil)](README.pt-BR.md)

X のアバター下にフォロー、フォローバック、確認付きフォロー解除を表示する Chrome / Edge 拡張機能です。対象アカウントと関係を確認したうえで、ユーザーのクリックから X 標準の操作を実行します。相互フォローは操作できない「蓝朋友」ラベルで表示します。

**0.3.11 プレビュー版。** 入力イベントの重複によるクイック返信の二重挿入を防ぎ、「挿入して返信」操作を追加しました。グループチャットの関係検出は実サイトで未検証です。

[ダウンロード](https://github.com/Jiangshuo1109/XPremium-Helper/releases) · [不具合報告](https://github.com/Jiangshuo1109/XPremium-Helper/issues) · [更新履歴](CHANGELOG.md)

開発者：**禁忌の小姜**。[X で @jiangza9 をフォロー](https://x.com/jiangza9)すると更新情報を確認できます。フォローは任意で、機能の利用条件ではありません。

> ⚠️ **免責事項：** 本拡張機能は独立したプレビュー版であり、X Corp. とは無関係です。各操作を確認し、X の規則を守ってください。関係判定、操作結果、将来の互換性は保証されません。詳しくは[免責事項](DISCLAIMER.md)をご覧ください。

## 機能と画面

以下は隔離ブラウザーの架空テストデータです。実際の X 操作成功を示しません。

<img src="docs/screenshots/popup.png" alt="XPremium-Helper パネル" width="360">

![アバター下の操作と相互フォロー表示](docs/screenshots/desktop-light.png)

| 機能 | 動作 |
| --- | --- |
| フォロー／フォローバック | 青い認証バッジと明確な関係情報が必要 |
| フォロー解除 | フォロー中で相互関係が未確認の場合に表示。対象アカウントの確認が必要 |
| 関係パネル | 開いた時点のアクティブな X タブの検索、関係フィルター、検出状況 |
| ページ統計 | 識別済み、フォロー中、相手からのフォロー、フォローバック待ち、相互、明確な非相互、未確認、申請済み、青い認証の9項目。重複と本人を除外 |
| 更新とリンク | 自動・手動のバージョン確認。GitHub API が失敗したら公開フィードを参照。ダウンロード、作者、GitHub への入口 |
| Enter で投稿・返信 | 単一エディターが対象。Shift+Enter で改行。IME 入力中とメンション選択中は送信しない |
| 読み取り制御 | 最大20人の確認キュー、1分間のメモリーキャッシュ、操作優先、速度制限時の30分間クールダウン処理 |
| 表示 | ライト／ダーク、狭いデスクトップウィンドウ。スマートフォンでの拡張機能対応を意味しない |

<details>
<summary>ダーク表示・解除確認・パネル・狭いウィンドウ</summary>

![ダーク表示](docs/screenshots/desktop-dark.png)
![解除の確認](docs/screenshots/unfollow-confirm.png)
![相互フォローで絞り込み](docs/screenshots/popup-filtered.png)
![模擬クールダウン](docs/screenshots/popup-cooldown.png)
<img src="docs/screenshots/narrow-light.png" alt="幅390pxのウィンドウ" width="390">

</details>

統計はこのページで識別したアカウントだけが対象で、全フォロワー数や操作回数ではありません。項目は重複するため合計できません。相手がフォローしていないという明確な証拠がない場合は未確認扱いです。検索とフィルターはリストだけに適用され、統計の対象は変わりません。

## インストールと更新

1. [Releases](https://github.com/Jiangshuo1109/XPremium-Helper/releases) の最新 **Pre-release** から `xpremium-helper-chrome-<version>-preview.zip` または `edge` 版を取得します。「Source code」は直接インストール用ではありません。
2. 固定フォルダーへ展開し、`chrome://extensions` または `edge://extensions` を開きます。
3. デベロッパーモードを有効にし、展開済み拡張機能の読み込みから `manifest.json` のあるフォルダーを選びます。
4. 未送信の下書きを処理してから X の既存タブを再読み込みします。拡張機能のパネルで有効／無効を切り替えられます。
5. 更新時は同じフォルダーを新しいファイルで置き換え、拡張機能を再読み込みしてから X を更新します。

パネルを開くと公開バージョンを確認します。成功結果は6時間、失敗は1分間キャッシュし、手動確認はキャッシュを使いません。新版はダウンロード入口、失敗は理由を表示します。ストア配布・自動インストールはなく、更新は手動です。`SHA256SUMS` と `shasum -a 256 <file.zip>`（macOS）または `Get-FileHash <file.zip> -Algorithm SHA256`（PowerShell）の結果を比較できます。

最初はテストアカウントで確認してください。**有効時、単一エディターの Enter は投稿・返信を送信します。** 改行は Shift+Enter。DM、複数エディターのスレッド、予約投稿は元の動作を維持します。

## 制約とプライバシー

本人確認や関係、操作可能な標準ボタンが不足すると入口は表示されません。ホーム、投稿詳細、返信、フォロワー／フォロー中リストに対応処理がありますが、実際の DOM に依存します。グループチャットは明確な関係フィールドが必要で実サイト検証待ちです。DM 一覧とヘッダーも未完成です。「フォローされています」がないだけでは相手の非フォローを証明できません。

パネルは開いた時点のタブに固定され、2秒ごとに状態を取得します。手動更新も可能です。タブ切り替え後はパネルを開き直してください。状態が取得できない場合は空のリストを表示します。画面上の成功はサーバーの最終確定ではありません。失敗した関係操作の自動再試行、自動スクロール、一括フォロー／解除、自動いいね、DM 自動送信はありません。

スクリプトは `https://x.com/*` にだけ注入されます。`storage` に加え、公開バージョン確認用の `https://api.github.com/*` と `https://github.com/*` のホスト権限があります。確認リクエストにログイン認証情報や X のアカウント・関係データは含みません。API キー、テレメトリー、Cookie 権限、独自サーバーは不要です。X の操作は X に送信されます。設定、クールダウン、更新確認結果はローカル保存。パネルは対象タブのメモリーを直接読み取りますが、互換用の要約とタスクの保存処理は残ります。**session が利用できない場合はローカル保存に切り替わり、再起動後も残る場合があります**。[プライバシー](PRIVACY.md)と[検証記録（中国語）](docs/验证记录.md)を参照してください。

## 開発と参加

Node.js 22+、npm、パッケージ作成用の `zip` が必要です。Windows は WSL を利用するか配布済み ZIP を使用してください。

```sh
git clone https://github.com/Jiangshuo1109/XPremium-Helper.git
cd XPremium-Helper
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run check:release
npm run package
```

`dist/chrome` または `dist/edge` を読み込みます。配布 ZIP は `release/`、テスト結果は `artifacts/` に生成され、Git 対象外です。公開画像は `docs/screenshots/` にあります。テストは通信を遮断した架空ページを使い、Chromium を必須とします。未導入または失敗した Chrome / Edge は合格扱いにしません。

[貢献方法](CONTRIBUTING.md) · [セキュリティ](SECURITY.md) · [免責事項](DISCLAIMER.md) · [リリース手順](docs/RELEASING.md) · [今後の予定](docs/ROADMAP.md)

報告から実際の会話、アカウント一覧、認証情報、個人パスを除いてください。更新通知は **Watch → Custom → Releases** または [禁忌の小姜 @jiangza9](https://x.com/jiangza9) から確認できます。

## ライセンス

[MIT](LICENSE)。著作権表示とライセンスを保持すれば、商用を含む利用・変更・再配布が可能です。依存ライブラリーのライセンスと X の商標権はそれぞれの権利者に帰属します。
