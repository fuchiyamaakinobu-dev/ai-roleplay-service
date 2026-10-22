# 2026-10-22 来店了承の修正

- 対象: 車検誘致・引取納車対応。
- 一日預かりへの了承「はい」→来店確認への引取希望→通話継続「大丈夫ですよ」を handleReply のLLM保留経路で検証。
- 来店案内後の別文の預かり了承、最後の車両状態質問で誤って引取を開始しないことを確認。
- 登録済み音声文を再利用。採点規則、音声認識補正、ブラウザー音声禁止は変更なし。実機の音声再生・マイクは未検証。
- qa/check-*.mjs 全101件: 96件成功、5件失敗。失敗5件はHEAD bf1a550のapp.jsへ一時的に戻した比較でも同じ失敗。新規失敗なし。
- 既存失敗: check-inspection-pickup-delivery.mjs:452 (pickup/visit)、check-inspection-september-replies.mjs:68 (代車返答)、check-llm-intent-lab.mjs:35 (mock provider status)、check-oct17-conversations.mjs:20 (音声候補)、check-pickup-nine-audio.mjs:24 (oil候補)。テスト弱体化なし。本修正の範囲外として残す。
- 戻す場合はこの変更コミットをgit revertし、Pagesを再公開する。
