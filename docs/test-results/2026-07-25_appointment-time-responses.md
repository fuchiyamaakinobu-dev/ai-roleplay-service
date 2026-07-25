# 12カ月点検・予約時間返答テスト結果

実施日: 2026-07-25

## 対象

- 具体的な時刻が1件提示された場合の「では、その時間でお願いします。」
- 具体的な時刻が複数提示された場合の「では、早いほうでお願いします。」
- 具体的な時刻が複数提示された場合の「では、遅い時間でお願いします。」
- 日付未提示のまま午前・午後を質問された場合の「午前中がいいです。今週だと何日が空いていますか？」
- 日付確定後に午前中を提示された場合の「では、午前中でお願いします。何時が空いていますか？」
- 返答候補を一巡した直後に、同じ返答を連続させない制御
- 表示文と登録音声ID・MP3ファイルの対応

## 登録音声

- `customer_appointment_single_time.mp3`
- `customer_appointment_earlier_time.mp3`
- `customer_appointment_later_time.mp3`
- `customer_appointment_morning_need_date.mp3`
- `customer_appointment_morning_need_time.mp3`

## 自動確認

- `node --check app.js`: 成功
- `node --check audio-db.js`: 成功
- `node --check scenario.js`: 成功
- `node ../check-roleplay-consistency.mjs`: 成功
- `node ../check-scripted-flow.mjs`: 成功
- `git diff --check`: 成功

## 結果

日付と具体的な時刻が確定した場合だけ予約を確定し、スタッフが提示した時刻の数と内容に応じて、単一・早い・遅いの各返答を選べることを確認した。

午前・午後だけを質問され、日付が提示されていない場合は、午前中を希望したうえで空いている日付を聞き返し、日時未確定のまま終話しないことを確認した。

「日曜日の午前中」または日付確定後の「午前中はいかがですか？」には、午前中を選んだうえで具体的な時刻を聞き返し、同じ時間帯質問を繰り返さないことを確認した。

MP3の実際の発話内容と登録文の聴き比べは、ブラウザー実機で公開前に確認する。
