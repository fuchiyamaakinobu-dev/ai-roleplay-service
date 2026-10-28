# 2026-10-28 最終確認・採点・非常代替表示

公開版20261028-1。基準コミット2d28484101f33414654bf812933a194cc111326e。

- 本日の実発話で最終確認の2表現、返答「お願いします」、復唱達成を確認。
- 誤日付の復唱でも会話中は訂正せず、予約日は保持し不一致を採点へ記録。
- 代車に乗っていただくのは可能でしょうか、翌日17時にお引き渡しを認識。
- 来店預かり説明には「分かりました」を選択。
- 履歴にemergencyAudioがある場合、必要返答・元音声ID・直前発言をtextContentで表示。記録のない過去の「はい」を非常代替と推定しない。
- 新規check-oct28-recap-and-scoring、既存check-storage-scoring、check-result-historyが成功。
- 実LLM呼び出し・音声の実再生は未実施。日次上限とLLM出力形式不一致は今回の修正対象外。
- 保存済みの採点点数は書き換えない。変更の復元は今回のコミットをrevertし、キャッシュ版を更新して再公開する。
- 全108 QA：103成功、以前からの5失敗（pickup-delivery / september-replies / llm-intent-lab / oct17-conversations / pickup-nine-audio）。新規失敗なし。
