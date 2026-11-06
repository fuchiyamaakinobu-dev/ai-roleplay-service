# 2026-11-07 会話・音声修正の検証

対象バージョン: 20261107-1

## 確認済み

- 関連23スクリプト成功（下記）。待ち代車の単体テストは後から追加された採点依存関数がfixtureに不足しており、対象外配点のテスト範囲を保って補完後に再実行成功。
- 通常車検・引取納車の両方で、本番addMessage/commitMessageを通す会話を検証。
  - 8月30日の提案 → 何時が空いていますか？
  - お好きな時間 → 午前中でお願いします。
  - 8月21日への変更 → 何時が空いていますか？
  - 午前10時 → では、その時間でお願いします。
  - 21日10時の候補保持、非常代替なし、各MP3存在。
- 午後限定への午後希望、後半の距離・代車質問を優先、新しい日付での時刻質問、同一日付の反復抑止、未回答減点、返却時刻との区別。
- 音声不足の場合の非常用返答と本来の返答の表示・記録。
- 提供された2音声はコピー元とSHA256一致、MP3デコード確認。新たな不足音声は今回の検証で検出されていない。

## 限界

実マイク・実LLM通信・実機での聴取・画面レイアウトはこの検証の対象外。任意の言い回しで誤判定がゼロになることを保証するものではない。

## テスト

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

## 旧期待値の変更理由

- 9月会話: 直前に代車を希望済みなので、用意の確認には「お願いします」が妥当。直前の代車希望もassertする。
- 引取維持: 仕事を理由とする引取希望を、理由を解消しない日付付き来店依頼だけで変更しない。

## 復旧

今回のリリースコミットをrevertし、再公開する。提供音声の元ファイルは変更していない。
