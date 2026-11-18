# 2026年11月18日 ロープレ修正・検証記録

状態：ローカル修正完了、未公開。作業ブランチ fix/nov18-history-review。修正版番号 20261118-2。変更前コミット 9dab8f4。

## 修正内容

- 車検の来店メリット説明で引取相談を最初へ戻す処理、3回勧誘すると自動同意する処理を廃止。理由・受付状態を保持して既存の理由別分岐へ接続。
- 他店比較で引取希望が続く場合、選択肢のない同じ説明で来店へ変更しない。「整備の内容を直接お伝え」の言い換えも来店メリットとして扱う。
- 12カ月点検の来店合意後の待ち方確認に、従来音声の登録済み「はい、お願いします。」を返す。予約を進めたり引取へ戻したりしない。
- 引取理由が不明な場合の土日・他店舗の両方必須を解消。事情の確認・受け止めは採点対象のまま。
- 推奨トークへ車両状態・ガラス等の損傷確認、具体的な受付時刻、他店比較の受け止めと選択肢を補足。
- LLMのJSON全体を囲むコードフェンスを許容。原文根拠・回答対象・候補の検証は維持。形式エラーの種類と、候補なしの既存ルール対象を判定記録で区別。
- 公開APIのRetry-Afterをブラウザーへ渡し、待機期間中の再送を抑止。期限後は再試行できる。利用者のLLM設定・日次上限は維持。

## 変更ファイル

会話・採点：app.js
LLM処理：lab/selection-core.mjs、lab/intent-core.mjs、lab/roleplay-bridge.js、deploy/cloudflare/worker.mjs
読込版番号：index.html、cloud-scenario.js
仕様・変更履歴：docs/PROJECT_SPEC.md、docs/EVALUATION_RULES.md、docs/CHANGELOG.md
テスト：qa/check-nov18-history-review.mjs、check-public-llm-bridge.mjs、check-cloudflare-api.mjs、check-oct27-contextual-replies.mjs、check-nov2-history-contradictions.mjs、および版番号チェック2本。

## 検証

- 全132本を確認。最終的に117本成功、変更前からの失敗15本。今回の変更による未解決の新規失敗は0本。
- 変更前HEADを別の検証用ディレクトリに展開して失敗を比較。旧仕様「3回の勧誘で同意」を検証していた2本は、理由を保持した分岐の検証へ更新。
- 最後の会話分岐修正後、関連16本を再実行して成功。
- 新規テストで本日の待ち方発話、最後の質問の優先、LLM選択・保留・OFF・例外、本番addMessage経由の発話確定、MP3存在、理由別採点を確認。
- 仕事・距離・運転不安・他店比較で4回繰り返し提案しても理由を保持し、反復回数だけで来店へ同意しないことを確認。
- 模擬HTTP応答でコードフェンス、余計な文章、原文根拠不一致、回答対象不一致、出力打切り、429待機時間を検証。
- ブラウザー用コードのDOM模擬テストで待機中の再送なし、期限後再開、表示理由を確認。
- 構文チェックとgit diff --check成功。

会話画面の実ブラウザー操作、実マイク、MP3の聴取は未実施。録音済み音声を再利用し、MP3と登録文は編集していない。

## 制約と公開

Groq側の利用制限はアプリから解除できない。制限中も既存ルールで継続する。過去に起きた出力形式エラーは生の応答が保存されていないため、原因を断定していない。許容できる書式を補正し、残る不正出力を分類して安全に復帰する。

公開する場合はGitHub Pages側とCloudflare Worker側の両方を更新する必要がある。新しい待機了承候補をWorker側でも認識させるため、Workerを先に反映してから静的サイトを更新する。

保存済み会話・点数、Firestoreデータ、APIキー、日次上限、音声ファイル、既存の未追跡ファイルは変更していない。

元に戻す場合は今回の差分を確認して逆適用する。公開後の復旧は静的サイトを変更前コミット9dab8f4、Workerを公開前のバージョンへ戻す。作業ディレクトリ全体のリセットは既存の未追跡資料を巻き込むため行わない。

## 修正前から失敗しているテスト

古い部分関数抽出の依存不足、古い音声・会話期待値、旧トークン上限、DOM模擬の不足など。今回の117本成功と区別して残す。

- check-inspection-booking-invitation-reply.mjs
- check-inspection-conversation-memory.mjs
- check-inspection-incomplete-appointment.mjs
- check-inspection-mileage-confirmation.mjs
- check-inspection-oct06-consistency.mjs
- check-inspection-oct07-consistency.mjs
- check-inspection-oct11-dialogue.mjs
- check-inspection-post-booking-guidance.mjs
- check-inspection-sep08-question-replies.mjs
- check-inspection-sep11-targeted-replies.mjs
- check-inspection-sep20-targeted-fixes.mjs
- check-inspection-sep29-contradictions.mjs
- check-inspection-three-transcript-scoring.mjs
- check-llm-intent-lab.mjs
- check-llm-trace.mjs

## 公開作業（2026-11-18）

- Cloudflare Workerを先行公開。バージョン98f01aed-e4c3-4451-8c3a-523fefcd9215。公開前は4ad7164a。
- 公開APIのready=trueを確認。新しいwaiting_confirmation候補を含む実Groq通信はHTTP 200・status=okで応答。判断はruleとなり、既存ルールへの委譲も正常。
- GitHub Pagesは本変更をmainへ反映して公開する。配信の最終照合結果は成果物の検証レポートへ記録する。
