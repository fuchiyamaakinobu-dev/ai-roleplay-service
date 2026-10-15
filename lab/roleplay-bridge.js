(() => {
  const config = window.ROLEPLAY_LLM_CONFIG;
  const isPublic = config?.public === true;
  if (isPublic && !config.apiBase) return;
  const api = path => (isPublic ? config.apiBase : '') + path;
  // Local trial sessions must not be queued for later production history upload.
  if (!isPublic) {
  window.ROLEPLAY_RESULTS = { recordStart() {}, saveResult() {} };
  const historyStatus = document.querySelector('#resultSaveStatus');
  if (historyStatus) {
    historyStatus.removeAttribute('id');
    historyStatus.textContent = 'ローカル検証用：履歴は保存しません。印刷は利用できます。';
  }
  for (const link of document.querySelectorAll('a[href]')) {
    if (/^\.\/(admin|history|audio-list|judgement-glossary)\.html$/.test(link.getAttribute('href'))) link.remove();
  }
  }
  const panel = document.createElement('section');
  panel.className = 'manager-steps';
  const label = document.createElement('label');
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = true;
  toggle.disabled = true;
  label.append(toggle, ' LLMが返答・MP3を選ぶ（3シナリオ対応）');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = '接続設定を確認しています。';
  const remaining = document.createElement('p');
  remaining.setAttribute('role', 'status');
  remaining.textContent = '本日のLLM残り —／50回（全利用者合計）';
  panel.append(label, remaining, status);
  const refreshUsage = async (initial = false) => {
    try {
      const response = await fetch(api('/api/status'));
      if (!response.ok) throw new Error();
      const data = await response.json();
      toggle.disabled = !data.ready;
      if (Number.isInteger(data.used) && Number.isInteger(data.limit) && data.used >= 0 && data.limit > 0) {
        remaining.textContent = `本日のLLM残り ${Math.max(0, data.limit - data.used)}／${data.limit}回（全利用者合計）`;
      } else remaining.textContent = '本日のLLM残り：確認できません';
      if (initial) status.textContent = data.ready ? '' : 'API未接続。既存ルールで練習できます。';
    } catch {
      remaining.textContent = '本日のLLM残り：確認できません';
      if (initial) status.textContent = '接続を確認できません。既存ルールで練習できます。';
    }
  };
  const tracePanel = document.createElement('details');
  const traceTitle = document.createElement('summary');
  traceTitle.textContent = '返答チェック：発話の解釈・音声選択を確認';
  const traceView = document.createElement('pre');
  traceView.style.whiteSpace = 'pre-wrap';
  const traceClear = document.createElement('button');
  traceClear.type = 'button';
  traceClear.textContent = '確認記録を消去';
  tracePanel.append(traceTitle, traceView, traceClear);
  panel.append(tracePanel);
  let trace = null;
  const traces = [];
  const labels = {question:'質問',request:'お願い・依頼',explanation:'説明',acknowledgement:'相づち',unclear:'判断不能',
    booking_intent:'入庫意思',weekday:'曜日希望',mileage:'走行距離',work:'車両状態・作業希望',contact:'連絡先',pickup_reason:'引取理由',pickup_location:'引取場所',
    delivery_location:'返却場所',duration:'作業時間',waiting:'待ち方',loaner:'代車',appointment:'予約日時',other:'その他'};
  const renderTrace = () => {
    traceView.textContent = traces.length ? traces.slice().reverse().map(t => [
      'スタッフ：' + t.text,
      'LLM判定：' + (t.meaning || '未実行（対象外・既存ルール）'),
      '根拠：' + (t.evidence || '—'),
      'LLM選択：' + (t.selected || 'なし'),
      '経路：' + (t.route || '既存ルール／応答待ち'),
      '実際の返答：' + (t.reply || '応答待ち'),
      '音声ID：' + (t.audioId || '—'),
      '音声再生：' + (t.playback || '未確認')
    ].join('\n')).join('\n\n') : 'この画面内だけに直近20発話を記録します。更新すると消えます。音声認識前の録音は保存しません。';
  };
  traceClear.addEventListener('click', () => { traces.length = 0; trace = null; renderTrace(); });
  renderTrace();
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
    const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.src = (isPublic ? './audio-ondoku/' : '/roleplay/audio-ondoku/') + item.file;
    audio.addEventListener('play', () => { for (const other of extras.querySelectorAll('audio')) if (other !== audio) other.pause(); });
    row.append(caption, audio); extras.append(row);
  }
  panel.append(extras);
  document.querySelector('.topbar').after(panel);
  window.ROLEPLAY_INTENT_ASSIST = {
    traceMessage(message) {
      if (message.role === 'staff') {
        trace = { text: message.text };
        traces.push(trace);
        if (traces.length > 20) traces.shift();
      } else if (message.role === 'customer' && trace) {
        trace.reply = message.text; trace.audioId = message.audioId; trace.audioSrc = message.audioSrc;
        if (trace.selectedId && trace.selectedId !== message.audioId) trace.route = 'LLM選択と異なる音声をアプリが採用';
        else if (trace.selectedId) trace.route = 'LLM選択をアプリが採用';
      }
      renderTrace();
    },
    tracePlayback(src, result) {
      if (trace?.audioSrc === src) { trace.playback = result; renderTrace(); }
    },
    enabled: () => toggle.checked && !toggle.disabled,
    pickupSettings: () => ({ schedule: scheduleChoice.value, location: locationChoice.value, waiting: waitingChoice.value }),
    async select(request) {
      const currentTrace = trace;
      if (currentTrace) { currentTrace.route = 'LLMへ問い合わせ中'; renderTrace(); }
      if (request.text.length > 600) return null;
      status.textContent = '会話の流れから返答を選んでいます…';
      try {
        const response = await fetch(api('/api/select'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request), signal: AbortSignal.timeout(7000) });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!toggle.checked) return null;
        const choice = data.llm?.judgement;
        if (currentTrace) {
          currentTrace.meaning = choice ? (labels[choice.kind] || choice.kind) + ' ／ ' + (labels[choice.topic] || choice.topic) : '判定取得なし';
          currentTrace.evidence = choice?.evidence;
          currentTrace.selected = choice?.rejectedId ? choice.rejectedId + '（意味と音声が不一致のため拒否）' : choice?.id || 'なし';
          currentTrace.selectedId = choice?.id !== 'rule' ? choice?.id : null;
          currentTrace.route = choice?.id === 'rule' ? 'LLM保留・不適合 → 既存ルール' : data.llm?.status === 'ok' ? 'アプリ適用待ち' : '既存ルール（' + (data.llm?.status || '応答なし') + '）';
          renderTrace();
        }
        const candidate = request.candidates.find(c => c.id === choice?.id);
        if (data.llm?.status === 'ok' && candidate) {
          status.textContent = `LLM選択：「${candidate.text}」（${(data.elapsedMs / 1000).toFixed(2)}秒）`;
          return { id: candidate.id };
        }
        status.textContent = data.llm?.status === 'cooldown'
          ? '15秒間隔の利用制限のため、今回は既存ルールで応答します。'
          : `LLM選択を採用できませんでした（${data.llm?.status || '応答なし'}${choice?.id === 'rule' ? '・既存処理を選択' : ''}）。今回は既存ルールで応答します。`;
        return null;
      } catch {
        if (currentTrace) { currentTrace.route = '通信失敗 → 既存ルール'; renderTrace(); }
        status.textContent = '通信を確認できないため、既存ルールで応答します。'; return null;
      } finally { void refreshUsage(); }
    },
    async resolve(text) {
      if (isPublic) return null;
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
      finally { void refreshUsage(); }
    }
  };
  void refreshUsage(true);
  if (window.setInterval) window.setInterval(() => { void refreshUsage(); }, 60000);
})();
