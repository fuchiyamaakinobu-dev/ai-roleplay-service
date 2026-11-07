# 公開APIの構成と更新

GitHub Pagesの画面・MP3を維持し、Groq通信だけWorkers Freeに配置する。
SQLite Durable Objectで全利用者合計1日50回（日本時間）を永続管理する。現行Workerに15秒間隔制限はない。
Groqの429時はRetry-Afterに従い1秒〜24時間、指定がなければ60秒停止。無料枠の容量を保証する数値ではなくアプリ独自の上限。
公開APIはログイン認証なし。Origin制限は認証ではないため第三者が上限を消費する可能性がある。
回数や時刻以外のスタッフ発言・キーはDurable Objectに保存しない。

## アカウント登録後の手順

1. Cloudflareへ登録、メール認証。Workers Freeを使用。有料プラン・独自ドメインは不要。
2. Wranglerでログインし、このフォルダの設定でdeploy。
3. GROQ_API_KEYをWorkerのSecretとして登録（リポジトリ・画面・通常変数に書かない）。
4. LLM_ENABLEDをtrueにして更新。
5. 発行されたHTTPS URLをフロントエンドへ接続する。ローカル用bridgeの履歴無効化を公開画面へそのまま適用しない。
6. 公開URLでCORS、意味判断、音声、既存の履歴保存を検証してからGitHub Pagesへ反映。

既存の公開先は https://ai-roleplay-api.fuchiyama-akinobu.workers.dev 。GROQ_API_KEYは既存Secretを維持する。候補actionや選択検証を更新する場合は、Workersを先に更新してから対応フロントを公開する。
LLM_ENABLED=falseでAPIを止められる。Groqキーを削除した場合も既存ルールへ戻す。
