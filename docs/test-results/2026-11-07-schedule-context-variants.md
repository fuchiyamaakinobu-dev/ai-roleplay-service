# 日時文脈・追加検証 2026-11-07

公開対象: 20261107-2

## 発見した原因と修正

- 月を省略した日付を単発の文だけで解析していた。直前の候補月から補完する。
- 「午後しか空いていません」を午後不可と判定していた。限定表現と否定を分ける。
- 入庫時刻と終了時刻、不可時刻と代替時刻を同じ候補群として数えていた。入庫用の肯定時刻を抽出して、予約候補と未回答採点に使用する。
- 日付変更時に旧候補の時刻が残っていた。旧日付の候補を破棄する。
- 分割日時処理が通常車検だけで、引取納車シナリオの通常相談と挙動が異なっていた。共通化し、引取分岐の専用処理には割り込まない。

## 実際に通した例

いずれも先に「8月30日はいかがでしょうか？」を発話。

| スタッフ | AI返答・保持状態 |
|---|---|
| では21日はいかがでしょうか？ | 何時が空いていますか？／8月21日保持 |
| 午後しか空いていません。お好きな時間でお取りできますが、いかがでしょうか？ | 午後でお願いします。 |
| 午前中は予約が埋まっています。午後のご都合はいかがでしょうか？ | 午後でお願いします。 |
| 午前10時にご来店ください。終了は午後4時の予定です。 | では、その時間でお願いします。／入庫10時 |
| 10時は空いていません。11時はいかがでしょうか？ | では、その時間でお願いします。／入庫11時 |
| 10時しか空いていませんが、いかがでしょうか？ | では、その時間でお願いします。／入庫10時 |

## 検証

- 27テストスクリプト成功。最後の本人確認・電話許可の保護追加後、直接影響する3本も再実行成功。
- 新規: 7発話×2シナリオ×3設定（LLM保留/OFF/例外スタブ）=42変種、日付変更の6連続会話。
- 本番addMessage/commitMessageを使用。画面描画・録音・実音声再生はスタブ。再生呼出先、MP3存在、非常代替なし、日時候補、未回答採点をassert。
- 共通分岐で確定する発話はLLM呼出より先に処理される。実LLM通信の成功を検証したものではない。
- 引取進行中/分岐済みへの不介入、後半の本人確認/電話許可/車両/代車優先、両時間帯不可の即答抑止も確認。
- 実マイク認識・実LLM通信・聴取・画面レイアウトは未確認。全ての自由発話に対する無誤判定保証ではない。
- 追加音声不要。元音声・履歴データ・APIは変更していない。

## 実行テスト

- PASS check-nov7-schedule-context-variants
- PASS check-nov7-production-replies
- PASS check-nov7-time-context
- PASS check-nov6-date-question-scope
- PASS check-public-llm-bridge
- PASS check-inspection-expanded-conversation-matrix
- PASS check-nov6-shared-answer-target
- PASS check-nov6-booking-consistency
- PASS check-inspection-early-booking-flow
- PASS check-emergency-audio-record
- PASS check-audio-isolation
- PASS check-nov2-question-memory
- PASS check-staff-speech-analysis
- PASS check-pickup-nine-audio
- PASS check-oct17-conversations
- PASS check-inspection-pickup-delivery
- PASS check-inspection-september-replies
- PASS check-cloud-scenario-compatibility
- PASS check-nov3-insurance-advice
- PASS check-inspection-waiting-loaner-branch
- PASS check-inspection-loaner-confirmation
- PASS check-nov5-final-question
- PASS check-nov2-history-contradictions
- PASS check-storage-scoring
- PASS check-schedule-time-parsing
- PASS check-inspection-booking-time-phrasing
- PASS check-inspection-history-replay-regressions

## 復旧

本リリースのコミットをrevertして再公開する。
