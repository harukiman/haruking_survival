# 改善ウェーブ手順書 — オーケストレーター用

1波 = 検出→検証→修正→再検証→出荷 の完結単位。所要 ≈ 30-60分。

## 前提
- ローカルサーバ: `python3 -m http.server 8799` (リポジトリルート)
- puppeteer: `PUPPETEER_DIR` 環境変数 or `~/pachinko-goty/node_modules/puppeteer-core`

## 手順

### 1. Playtest
```
node audit/lint.js && node smoke.js && node audit/run.js --wave NN
```
- smoke 赤 → 波を中断しそれを直す
- 生成物: `audit/wave-NN/shots/*.png`, `audit/wave-NN/results/*.json`, `summary.json`
- 追加で P1 をランダムシードで 1 回: `node audit/run.js --persona p1 --seed <rand> --wave NNr`

### 2. 監査ファンアウト (並列サブエージェント)
- ペルソナ別視覚エージェント ×5: 担当ペルソナの shots (画像として読む) + results JSON + RUBRIC.md + findings.json (既知重複回避) → findings JSON
- メトリクス変換エージェント ×1: 全 results JSON のハード違反 (tap<44px / font<12px / overlap / silent action / stuck / FPS p95>33ms) を file:line 特定付き findings に変換

### 3. dedupe + 敵対的検証 (1エージェント)
- (category + 対象要素/画面) で重複統合
- 各候補を検証: コード実読 / `node audit/run.js --persona pX` 再実行 / スクショ再確認。検証不能は破棄
- 選定: P0 全部 + P1 を露出頻度順、**1波 3-6 件**。残りは findings.json に `open` で登録

### 4. 修正ファンアウト
- 選定 findings をファイル単位でグルーピング → グループ毎に1修正エージェント (競合回避)
- 規律: 最小diff / IIFE モジュール維持 / UPPERCASE 定数への後付け代入禁止 /
  モバイルファースト / ふりがな禁止 / タップターゲットは44px以上へ / 数値インフレ禁止

### 5. 検証
```
node audit/lint.js && node smoke.js
node audit/run.js --persona pX --wave NNv   # 修正対象を出したペルソナのみ
```
- before/after スクショ比較で解消確認 → findings.json を `fixed` に
- 解消しない/悪化 → revert して `wontfix` + 理由

### 6. 出荷
- キャッシュバージョン bump (index.html `?v=` と build ラベル、現行系列 v530〜)
- `git grep -n "/Users/"` で露出ゼロ確認 → commit (finding id 列挙) → push

## 終了条件
2波連続で新規検証済み P0/P1 がゼロ → P2 ポリッシュ波 1-2回 → 停止。
数値リグレッション (FPS低下/遅延増) は summary.json の波間比較で自動 finding 化。
