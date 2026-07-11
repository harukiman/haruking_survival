# 視覚監査ルーブリック — haruking_survival

スクリーンショット監査エージェントが適用するヒューリスティック。**証拠なき finding は無効**
（スクショ名 or メトリクスキーを必ず evidence に含める）。主プレイ環境はスマホ (390×844)。

## 6カテゴリ

### 1. onboarding — 導入明瞭性
- 操作可能になって 60 秒以内に「次に何をすべきか」が画面から読み取れるか
- 最初のクエストは文字を読まなくても気づけるか (位置・コントラスト・動き)
- カットシーンは文脈を与えているか、単に遊びを遅らせていないか。スキップ導線は初見に見えるか
- 初見が迷いそうな瞬間 (何をタップしていいかわからない画面) がないか

### 2. feedback — フィードバック & ジュース
- プレイヤーの全アクションに即時の可視反応があるか (metrics: `firstAction.feedback.silent`, `feedbackLatency`)
- ダメージ/入手/クラフト/クエスト達成の演出は重要度に比例しているか
- 空振り (対象なしで攻撃) にも「操作は受け付けた」感があるか
- toast が多すぎて重要情報が流れていないか (metrics: `toast.spamRate`)

### 3. readability — 390px 可読性
- 全スクショで文字が読めるか (metrics: `fontScan` <12px 違反)
- 夜間・混戦時のキャンバス背景に対する HUD コントラスト
- アイコンの意味が推測可能か。日本語が不自然な位置で折り返されていないか
- (禁止事項: ふりがな・reading フィールドは決して追加しない)

### 4. ergonomics — エルゴノミクス & 届きやすさ
- アクションボタンは親指の弧の内側か。重要操作が上端角にないか
- タップターゲット ≥44px (metrics: `tapTargetScan.violations`)、隣接ギャップ ≥8px (`adjacency`)
- ジョイスティック域と UI の競合 (metrics: `joystick.direction8.failures`, `elementFromPoint` 系)
- ホームインジケータ/ノッチとの干渉 (metrics: `layout.bottomEdge`)

### 5. hierarchy — 情報階層
- 混戦スクショで HP が最も目立つ要素か
- クエストトラッカーは「気づけるが支配しない」か
- toast の表示位置がゲームプレイ/照準を隠していないか (metrics: `hudOverlapScan.overlaps`)

### 6. pacing — ペーシング
- P1/P4 タイムラインに「やることがない死に時間」がないか
- クエスト難度スパイク (metrics: `quest.chain.steps[].latencyMs` の外れ値)
- プレイヤーが準備できる前に夜が来ていないか (metrics: `pacing.state`)
- ムービー頻度・尺は適切か (metrics: `quest.chain.steps[].storySkips`, `cutscene.watch.durationSec`)

## Finding 出力形式 (機械マージ可能・必須)

```json
{
  "id": "w01-p2-03",
  "severity": "P0|P1|P2",
  "category": "onboarding|feedback|readability|ergonomics|hierarchy|pacing",
  "summary": "一文での欠陥記述",
  "evidence": ["p2-touch-03-joystick-active.png", "metric: joystick.deadzone.minDragPx=null"],
  "suggested_fix": "具体的な修正方向",
  "files_suspected": ["js/input.js", "css/style.css"],
  "confidence": "high|med|low"
}
```

- **P0**: プレイ不能/コア操作が発見不能/入力が効かない
- **P1**: 毎セッション感じる実摩擦
- **P2**: ポリッシュ
- id 規約: `w{wave}-{p1..p5|m(metrics)|v(vision)}-{連番}`

## 既知の仕様 (finding にしないこと)
- セーブ/ロード後の questIndex 前進: クエストはインベントリ/実績から再導出される設計
- ストーリー章の初回自動ムービー: 仕様 (ただし頻度・尺・スキップ導線の質は監査対象)
- `game`/`hud` 等の全画面コンテナ同士の重なり
