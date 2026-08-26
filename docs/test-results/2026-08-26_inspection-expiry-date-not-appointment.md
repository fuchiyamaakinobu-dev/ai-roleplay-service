# 車検満了日と予約候補日の分離テスト

実施日: 2026-08-26

## 対象

- 車検満了日と都合確認をまとめたスタッフ発話
- 車検満了日と具体的な入庫日時をまとめたスタッフ発話

## 期待結果

- 車検満了日の月日を予約候補日として扱わない
- 日時未提示の都合確認には「お願いしたいんですけど、いつできますか？」と返答する
- 満了日とは別に提示された入庫日時は予約候補として保持する

## 自動確認

- `node --check app.js`: 成功
- `node qa/check-inspection-booking-invitation-reply.mjs`: 成功
- `node qa/check-inspection-booking-step-skip.mjs`: 成功
- `qa/*.mjs` 全40件: 成功（失敗0件）
