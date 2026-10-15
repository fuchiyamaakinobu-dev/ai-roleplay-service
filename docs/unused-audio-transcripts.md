# 未使用音声4本の文字起こし

2026-10-16、ユーザーの外部送信許可を受け、保存済みGroq接続で4本を音声認識した。モデルはwhisper-large-v3、日本語指定、temperature=0。以下は自動文字起こしの原文であり、人による聴き取りの確定稿ではない。返答設定・使用停止状態・公開アプリは変更していない。

| ファイル | 自動文字起こし原文 | 現在の状態 |
|---|---|---|
| audio/customer_pickup_05.mp3 | 近くまで来てもらうことはできませんか。 | 登録済み・disabled |
| audio/customer_objection_competitor_02.mp3 | 取りに来てくれる別なお店ありませんか? | 登録済み・disabled |
| audio-ondoku/inspection_confirmed_identity_retry.mp3 | どちらにおかけですか? | 音声一覧に未登録 |
| audio-ondoku/inspection_identity_missing_after_introduction.mp3 | はい、どちらにおかけですか? | 音声一覧に未登録 |

元ファイルのSHA-256:

- customer_pickup_05.mp3: 2608d23d34344b6cbc535577530d7d007206375c5c1b443c9b248f563abfa128
- customer_objection_competitor_02.mp3: a28ff0f7f0aea3121ed0bc16f571df3397129842f60595e6f8d4d91f43c9d935
- inspection_confirmed_identity_retry.mp3: ce7890b645b5d020d3f3609c426f4a018419ad8128ff4cb8fbf987c64b6da698
- inspection_identity_missing_after_introduction.mp3: 7bfa76c341806a05075d45ac9a5bd3d1506204540dfee4095fdfd24f0ba30f87

詳細な認識結果（区間の認識指標を含む）はPC内のtmp/unused-audio-transcripts.jsonに保存。
