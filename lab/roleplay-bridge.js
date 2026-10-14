(() => {
  // Local trial sessions must not be queued for later production history upload.
  window.ROLEPLAY_RESULTS = { recordStart() {}, saveResult() {} };
  const historyStatus = document.querySelector('#resultSaveStatus');
  if (historyStatus) {
    historyStatus.removeAttribute('id');
    historyStatus.textContent = 'ローカル検証用：履歴は保存しません。印刷は利用できます。';
  }
  for (const link of document.querySelectorAll('a[href]')) {
    if (/^\.\/(admin|history|audio-list|judgement-glossary)\.html$/.test(link.getAttribute('href'))) link.remove();
  }
  const panel = document.createElement('section');
  panel.className = 'manager-steps';
  const label = document.createElement('label');
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.disabled = true;
  label.append(toggle, ' LLMが返答・MP3を選ぶ（3シナリオ対応）');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = '接続設定を確認しています。';
  const note = document.createElement('p');
  note.textContent = 'ONにすると、発言・直近4発話・進行状況と返答候補をGroqへ送信します。架空の情報で練習してください。12カ月点検は受付〜引取希望、車検上級・応用は走行距離・追加作業・連絡先への返答、応用は引取理由・場所への返答もLLM選択です。応用編の追加9音声は下の条件設定に対応します。日時確定・終話は既存ルールです。採点は既存ルール、音声は登録済みMP3です。履歴はクラウド保存しません。';
  panel.append(label, status, note);
  const extras = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = '応用編：追加音声の練習条件・9本の試聴';
  extras.append(summary);
  const choice = (title, values) => {
    const label = document.createElement('label');
    label.textContent = title + ' ';
    const select = document.createElement('select');
    for (const [value, text] of values) { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); }
    label.append(select); extras.append(label, document.createElement('br')); return select;
  };
  const scheduleChoice = choice('最初の日時提案', [['accept','通常どおり'],['other_date','別の日を希望'],['later_time','同じ日の遅い時間を希望']]);
  const locationChoice = choice('引取場所', [['home','自宅'],['workplace','職場']]);
  const waitingChoice = choice('来店に同意した後の過ごし方', [['store','店内で待つ'],['family','家族の迎え（代車不要）']]);
  const hint = document.createElement('p');
  hint.textContent = '条件は最初のスタッフ発言時に固定します。変更後は「やり直し」で開始してください。引取希望中に店内待ちへ勝手に変更しません。音声はユーザー提供の9本です。';
  extras.append(hint);
  const ids = ['vehicle_condition_no_concerns','oil_change_reconfirmed','cannot_wait_pickup_request','duration_accepted_wait_in_store','appointment_other_date_request','appointment_later_time_request','no_loaner_family_pickup','pickup_workplace_request','delivery_home_request'];
  for (const suffix of ids) {
    const item = window.ROLEPLAY_AUDIO_DB.items.find(i => i.id === 'inspection_' + suffix);
    const row = document.createElement('div');
    const caption = document.createElement('p'); caption.textContent = item.text;
    const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.src = '/roleplay/audio-ondoku/' + item.file;
    audio.addEventListener('play', () => { for (const other of extras.querySelectorAll('audio')) if (other !== audio) other.pause(); });
    row.append(caption, audio); extras.append(row);
  }
  panel.append(extras);
  document.querySelector('.topbar').after(panel);
  window.ROLEPLAY_INTENT_ASSIST = {
    enabled: () => toggle.checked && !toggle.disabled,
    pickupSettings: () => ({ schedule: scheduleChoice.value, location: locationChoice.value, waiting: waitingChoice.value }),
    async select(request) {
      if (request.text.length > 600) return null;
      status.textContent = '会話の流れから返答を選んでいます…';
      try {
        const response = await fetch('/api/select', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request), signal: AbortSignal.timeout(7000) });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!toggle.checked) return null;
        const choice = data.llm?.judgement;
        const candidate = request.candidates.find(c => c.id === choice?.id);
        if (data.llm?.status === 'ok' && candidate) {
          status.textContent = `LLM選択：「${candidate.text}」（${(data.elapsedMs / 1000).toFixed(2)}秒）`;
          return { id: candidate.id };
        }
        status.textContent = data.llm?.status === 'cooldown'
          ? '15秒間隔の利用制限のため、今回は既存ルールで応答します。'
          : `LLM選択を採用できませんでした（${data.llm?.status || '応答なし'}${choice?.id === 'rule' ? '・既存処理を選択' : ''}）。今回は既存ルールで応答します。`;
        return null;
      } catch { status.textContent = '通信を確認できないため、既存ルールで応答します。'; return null; }
    },
    async resolve(text) {
      if (!text || text.length > 400) return null;
      status.textContent = '発言の意味を確認しています…';
      try {
        const response = await fetch('/api/compare', { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, live: true }), signal: AbortSignal.timeout(7000) });
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (result.llm?.status !== 'ok') {
          const reasons = { cooldown: '30秒間隔の制限', daily_limit: '本日の検証上限', provider_limit: 'APIの利用制限', timeout: '応答時間超過', not_configured: '未接続' };
          status.textContent = `${reasons[result.llm?.status] || '判定を取得できませんでした'}：既存ルールで続けます。`;
          return null;
        }
        if (!toggle.checked) return null;
        const asksService = ['service_request', 'vehicle_concern'].some(key => {
          const item = result.llm.judgement?.[key];
          return item?.verdict === 'yes' && typeof item.evidence === 'string'
            && item.evidence.trim() && text.includes(item.evidence);
        });
        status.textContent = asksService
          ? '作業希望・車両状態の質問を認識し、既存の返答音声を選びました。採点への加点はありません。'
          : '追加作業・車両状態の質問とは判定されなかったため、既存ルールで続けます。';
        return { asksService };
      } catch { status.textContent = '通信を確認できないため、既存ルールで続けます。'; return null; }
    }
  };
  fetch('/api/status').then(r => r.json()).then(data => {
    toggle.disabled = !data.ready;
    status.textContent = data.ready ? '接続済み。チェックを入れると利用できます（1日50回・返答選択は15秒間隔）。' : 'API未接続。既存ルールで練習できます。';
  }).catch(() => { status.textContent = '接続を確認できません。既存ルールで練習できます。'; });
})();
