# 車検電話の自然な返答確認

- 提示された実会話をNode VMで順に入力し、指定3応答、音声IDとMP3ファイル存在、満了日で予約が確定しないことを確認。
- `node qa/check-inspection-september-replies.mjs`: 成功。
- `qa/check-inspection-*.mjs` 全36本: 成功。
- `node --check app.js`: 成功。
- ブラウザーでのマイク操作・MP3の実聴取は未実施。既存の登録文と音声ファイルを変更せず再利用。公開サイト・Firestoreは未更新。
- 戻す場合は本作業ブランチのapp.jsの差分を取り消す。
