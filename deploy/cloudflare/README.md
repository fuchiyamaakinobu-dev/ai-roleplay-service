# 無料公開の準備（まだ未公開）

GitHub Pagesの画面・MP3を維持し、Groq通信だけWorkers Freeに配置する。
SQLite Durable Objectで全利用者合計1日50回（日本時間）・15秒間隔を永続管理する。
Groqの429時は24時間停止。無料枠の容量を保証する数値ではなくアプリ独自の上限。
公開APIはログイン認証なし。Origin制限は認証ではないため第三者が上限を消費する可能性がある。
回数や時刻以外のスタッフ発言・キーはDurable Objectに保存しない。

## アカウント登録後の手順

1. Cloudflareへ登録、メール認証。Workers Freeを使用。有料プラン・独自ドメインは不要。
2. Wranglerでログインし、このフォルダの設定でdeploy。
3. GROQ_API_KEYをWorkerのSecretとして登録（リポジトリ・画面・通常変数に書かない）。
4. LLM_ENABLEDをtrueにして更新。
5. 発行されたHTTPS URLをフロントエンドへ接続する。ローカル用bridgeの履歴無効化を公開画面へそのまま適用しない。
6. 公開URLでCORS、意味判断、音声、既存の履歴保存を検証してからGitHub Pagesへ反映。

現時点はバックエンドのソース準備のみ。アカウント登録・Worker配置・Secret登録・フロント接続は未完了。
LLM_ENABLED=falseでAPIを止められる。Groqキーを削除した場合も既存ルールへ戻す。
