# 全確定発話の分析確認 2026-10-20
関連9テスト成功: all-final-speech-analysis, staff-speech-analysis, inspection-llm-selection, llm-reply-routing, cloudflare-api, llm-topic-consistency, inappropriate-termination, contextual-acknowledgements, inspection-expanded-conversation-matrix。
Groq実通信: 挨拶、日時復唱、積算距離質問、既存候補0件の「オドメーターの数字を教えていただけます？」を確認。最後はquestion/mileageで3万キロの音声選択に成功。挨拶で選ばれた不一致候補はサーバー検証でruleへ戻った。LLMの誤選択は引き続き起こりうる。
各送信1通信、上限・間隔制限は維持。実ブラウザー再現/マイク試験は未実施。ロールプレイ途中認識や未送信文字は送信しない。
変更: app.js/selection-core/bridge、キャッシュ、仕様、QA。戻す場合は当コミットをrevertしてWorkerとPagesを再公開。
