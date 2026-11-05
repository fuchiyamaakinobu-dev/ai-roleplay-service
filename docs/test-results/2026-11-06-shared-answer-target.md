# 2026-11-06 回答対象共通化の検証

## 結果

修正版の候補選定から公開APIへの3件の実LLM呼び出しを実施。ユーザーから送信先（公開WorkerとGroq）および模擬発話3件・登録候補の送信許可を得て実施し、全件HTTP 200、LLM status=ok。履歴データ・実スタッフ情報は送信していない。

| 模擬発話 | LLMが選んだ回答対象 | 実際の返答 |
| --- | --- | --- |
| ありがとうございます。ご希望の日を教えていただけますか？ | ご希望の日を教えていただけますか？ | 土日がいいです。 |
| 走行距離を教えてください。気になる症状はありますか？ | 気になる症状はありますか？ | 今のところ、特に気になるところはありません。 |
| 書類をお持ちください。確認のお電話はこの携帯でよろしいですか？ | 確認のお電話はこの携帯でよろしいですか？ | この携帯にお願いします。 |

3件目のconditionsには「書類をお持ちください。」が保持された。前半の候補を回答として選ばず、最後の質問に応答できた。

## 自動確認

- check-nov6-shared-answer-target: 96条件（2車検シナリオ×3工程×4表現×選択/保留/OFF/通信例外）。前半回答対象の拒否、未解決時の非常記録。
- check-structured-focus / check-nov5-final-question / check-nov5-history / check-nov2-history-contradictions。
- check-inspection-early-booking-flow / check-inspection-expanded-conversation-matrix（42パターン）。
- check-inspection-mileage-variants / check-inspection-conversation-memory / check-emergency-audio-record。
- check-staff-speech-analysis / check-all-final-speech-analysis / check-nov2-question-memory。
- check-contextual-acknowledgements / check-oct27-contextual-replies / check-speech-incomplete-continuation / check-public-llm-bridge。

上記はいずれも成功。API選択の3件以外は模擬LLM・ローカル実行による検証であり、実LLMによる96件検証ではない。

## 限界・公開状態

- 新共通分類は日程希望・走行距離・車両状態・連絡先。その他の話題は既存処理の回帰テストで確認した。
- ローカル検証サーバー起動後、in-app browserからの接続がERR_CONNECTION_TIMED_OUT。画面上の手動確認、実マイク入力、実音声の聴取は未完了。
- 公開中のAPIに修正版の候補を渡して確認したものであり、フロントエンドの修正版は未公開。
- LLMが意味を選択する。意味の異なる候補のランダム選択は実装していない。今回の4話題では状態に合う音声が1件の場合は1候補とする。
