# 入庫意思・曜日希望のLLM拡張

- QA 89本成功（HTTP検証1本を含む）。
- 上級・応用の両方で未知の言い換えが実際にselectへ渡り、既存音声へ接続することを代替APIで検証。
- 意味と候補の不一致、回答済み曜日、予約後の後退を検証。API失敗・OFF時の既存応答も回帰検証。
- 公開Workerの実Groqで「今回のお車の検査も私どもにお任せくださいますか？」→入庫意思・inspection_asked_availability_customer、294ms。
- 10月16日の再開時、実Groqで「お仕事の日とお休みの日、どちらがお越しになりやすいですか？」→曜日希望・inspection_day_preference_answer、305ms。
- マイク入力・音声の聴感確認は未実施。実APIの成功例は全発話の正解を保証しない。
- 戻す場合は今回のコミットをrevertし、WorkerとPagesを再公開する。
