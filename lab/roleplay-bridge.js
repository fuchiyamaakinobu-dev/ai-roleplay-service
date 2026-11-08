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
  panel.className = 'manager-steps decision-panel';
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
  const liveView = document.createElement('pre');
  liveView.style.whiteSpace = 'pre-wrap';
  liveView.setAttribute('role', 'status');
  liveView.setAttribute('aria-live', 'polite');
  liveView.setAttribute('aria-label', '現在の返答判定');
  const flowView = document.createElement('div');
  flowView.id = 'decisionFlowView';
  flowView.className = 'decision-flow';
  flowView.setAttribute('role', 'status');
  flowView.setAttribute('aria-live', 'polite');
  flowView.setAttribute('aria-label', '発話から返答までの判定フロー');
  const historyView = document.createElement('section');
  historyView.id = 'decisionHistoryView';
  const historyCards = new Map();
  const textDetails = document.createElement('details');
  textDetails.id = 'decisionTextDetails';
  const textSummary = document.createElement('summary');
  textSummary.textContent = '判定の詳細を読む';
  textDetails.append(textSummary, liveView);
  const displayLabel = document.createElement('label');
  const displayToggle = document.createElement('input');
  displayToggle.type = 'checkbox';
  displayToggle.id = 'decisionDisplayToggle';
  displayToggle.setAttribute('role', 'switch');
  displayToggle.setAttribute('aria-controls', 'decisionFlowView decisionTextDetails decisionHistoryView');
  liveView.id = 'decisionLiveView';
  displayToggle.checked = false;
  try { displayToggle.checked = localStorage.getItem('roleplayDecisionDisplay') === 'on'; } catch (_) {}
  const applyDisplay = () => {
    liveView.hidden = !displayToggle.checked;
    flowView.hidden = !displayToggle.checked;
    historyView.hidden = !displayToggle.checked;
    textDetails.hidden = !displayToggle.checked;
    displayToggle.setAttribute('aria-checked', String(displayToggle.checked));
  };
  displayToggle.addEventListener('change', () => {
    applyDisplay();
    try { localStorage.setItem('roleplayDecisionDisplay', displayToggle.checked ? 'on' : 'off'); } catch (_) {}
  });
  applyDisplay();
  displayLabel.append(displayToggle, ' 判定状態を表示（ON／OFF）');
  panel.append(displayLabel, flowView, historyView, textDetails);
  let liveState = null;
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
    listening:'説明への相づち',instruction:'依頼の理解',consent:'手続きへの承諾',pickup_confirmation:'引取手配の確認',identity:'本人確認',booking_intent:'入庫意思',weekday:'曜日希望',mileage:'走行距離',work:'車両状態・作業希望',contact:'連絡先',pickup_reason:'引取理由',pickup_location:'引取場所',
    return_confirmation:'作業後の返却確認',loaner_offer:'代車の用意・利用提案',booking_procedure:'引取未解決の手続き確認',delivery_location:'返却場所',duration:'作業時間',waiting:'待ち方',loaner:'代車',appointment:'予約日時',other:'その他'};
  const reasons = {selected:'LLM選択',off:'LLMがOFF',not_configured:'API未接続',not_requested:'LLM呼び出し対象外',daily_limit:'日次上限に到達',provider_limit:'Groqの利用制限',timeout:'応答待ち時間超過',network_error:'通信失敗',service_error:'サーバーエラー',provider_error:'Groq応答エラー',invalid_output:'LLM出力形式の不一致',input_limit:'入力文字数上限',rule:'LLMが判断を保留',topic_mismatch:'話題と音声の不一致',candidate_missing:'候補外の音声',adjusted:'LLM選択と異なる音声をアプリが採用'};
  const setReason = (t,key) => {if(t){t.reason=reasons[key] || '原因を特定できず';if(t.staffMessage)t.staffMessage.responseReason=t.reason;}};
  const flowElement = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const renderFlow = (entry = trace, destination = flowView, snapshot = liveState) => {
    const heading = flowElement('div','decision-flow-heading');
    heading.append(flowElement('strong','',destination === flowView ? '現在の返答判定' : 'この発話の返答判定'),flowElement('span','decision-flow-route',entry?.route || '発話待ち'));
    const grid = flowElement('div','decision-flow-grid');
    const input = flowElement('section','decision-flow-card decision-flow-input');
    input.append(flowElement('h3','','認識した発話'),flowElement('p','decision-flow-speech',entry?.text || 'スタッフの発話を待っています。'));
    if (entry?.answerTarget) input.append(flowElement('p','decision-flow-target','答える対象：'+entry.answerTarget));
    const candidates = flowElement('section','decision-flow-candidates');
    candidates.append(flowElement('h3','','返答候補'));
    const choices = (entry?.candidates || (entry?.candidateTexts || []).map(text=>({text}))).map(c=>({...c}));
    if (entry?.reply && !choices.some(c=>c.id ? c.id===entry.audioId : c.text===entry.reply)) {
      choices.push({id:entry.audioId,text:entry.reply,added:true});
    }
    if (!choices.length) candidates.append(flowElement('p','decision-flow-empty',entry ? '候補を確認しています。' : '発話後に候補を表示します。'));
    for (const c of choices) {
      const adopted = Boolean(entry?.reply && (c.id ? c.id===entry.audioId : c.text===entry.reply));
      const selected = Boolean(c.id && c.id===entry?.selectedId);
      const rejected = Boolean(c.id && c.id===entry?.rejectedId);
      const state = adopted ? 'adopted' : rejected ? 'rejected' : entry?.reply ? 'unused' : 'pending';
      const row = flowElement('div','decision-flow-option '+state);
      row.append(flowElement('p','',c.text),flowElement('span','decision-flow-badge',
        adopted ? (entry.intendedReply ? '非常代替' : '採用') : rejected ? '不適合' : selected ? (entry.reply ? 'LLM選択・未採用' : 'LLM選択') : entry?.reply ? '未採用' : '判定中'));
      if(c.added) row.append(flowElement('small','',entry.intendedReply ? '音声不足・判断不足による代替' : '既存ルールで採用した返答'));
      candidates.append(row);
    }
    const output = flowElement('section','decision-flow-card decision-flow-output'+(entry?.reply?' adopted':''));
    output.append(flowElement('h3','','実際の返答'),flowElement('p','decision-flow-speech',entry?.reply || '返答待ち'));
    if(entry?.intendedReply) output.append(flowElement('p','decision-flow-warning','本来の返答：'+entry.intendedReply));
    if(entry?.playback) output.append(flowElement('p','decision-flow-target','音声再生：'+entry.playback));
    const arrow = () => {const n=flowElement('span','decision-flow-arrow','→');n.setAttribute('aria-hidden','true');return n;};
    grid.append(input,arrow(),candidates,arrow(),output);
    const footer=flowElement('div','decision-flow-footer');
    footer.append(flowElement('p','','理由：'+(entry?.reason || '—')),flowElement('p','','予約：'+(snapshot?.appointment || '未確定')),flowElement('p','','受付方法・場所：'+(snapshot?.route || '未確定')));
    destination.replaceChildren(heading,grid,footer);
  };
  const renderTrace = () => {
    renderFlow();
    for (const [index, entry] of traces.entries()) {
      if (entry === trace || historyCards.has(entry)) continue;
      const details = flowElement('details','decision-history-entry');
      details.append(flowElement('summary','',`${index + 1}. ${entry.text} → ${entry.reply || '返答未確定'}`));
      const view = flowElement('div','decision-flow');
      renderFlow(entry,view,entry.snapshot);
      details.append(view); historyView.append(details); historyCards.set(entry,details);
    }
    liveView.textContent = [
      '現在の返答判定',
      '処理：' + (trace?.route || '発話待ち'),
      '答える対象：' + (trace?.answerTarget || '未判定'),
      '返答候補：' + (trace?.candidateTexts?.join(' ／ ') || '未選定'),
      '採用した返答：' + (trace?.reply || '未確定'),
      ...(trace?.intendedReply ? ['本来の返答：' + trace.intendedReply, '音声：非常用の返答で代替・不足記録あり'] : []),
      '理由：' + (trace?.reason || '—'),
      '予約：' + (liveState?.appointment || '未確定'),
      '受付方法・場所：' + (liveState?.route || '未確定')
    ].join('\n');
    traceView.textContent = traces.length ? traces.slice().reverse().map(t => [
      'スタッフ：' + t.text,
      'LLM判定：' + (t.meaning || '未実行（対象外・既存ルール）'),
      '答える対象：' + (t.answerTarget || '—'),
      '前提条件：' + (t.conditions?.join(' ／ ') || '—'),
      '根拠：' + (t.evidence || '—'),
      'LLM選択：' + (t.selected || 'なし'),
      '経路：' + (t.route || '既存ルール／応答待ち'),
      '理由：' + (t.reason || '未記録'),
      '実際の返答：' + (t.reply || '応答待ち'),
      ...(t.intendedReply ? ['本来の返答：' + t.intendedReply] : []),
      '音声ID：' + (t.audioId || '—'),
      '音声再生：' + (t.playback || '未確認')
    ].join('\n')).join('\n\n') : 'このロープレの全発話を記録します。更新すると消えます。音声認識前の録音は保存しません。';
  };
  traceClear.addEventListener('click', () => { traces.length = 0; trace = null; historyCards.clear(); historyView.replaceChildren(); renderTrace(); });
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
    noteCandidates(candidates) {
      if (trace) { trace.candidates = candidates.map(c=>({id:c.id,text:c.text})); trace.candidateTexts = candidates.map(c=>c.text); }
      renderTrace();
    },
    noteDecision(value) {
      if (trace) {
        trace.candidates ||= [];
        if (!trace.candidates.some(c=>c.text === value.candidate)) trace.candidates.push({text:value.candidate});
        trace.candidateTexts = trace.candidates.map(c=>c.text); trace.reason = value.reason;
      }
      renderTrace();
    },
    resetDecision() { trace = null; liveState = null; traces.length = 0; historyCards.clear(); historyView.replaceChildren(); renderTrace(); },
    updateDecisionState(value) { liveState = value; if (trace) trace.snapshot = {...value}; renderTrace(); },
    beginDecision(value) {
      if (trace) { trace.answerTarget = value.answerTarget; trace.route = '候補を選定中'; }
      renderTrace();
    },
    traceMessage(message) {
      if (message.role === 'staff') {
        trace = { text: message.text, staffMessage: message };
        setReason(trace,!toggle.checked?'off':toggle.disabled?'not_configured':'not_requested');
        traces.push(trace);

      } else if (message.role === 'customer' && trace) {
        message.responseSource = trace.selectedId ? (trace.selectedId === message.audioId ? 'llm' : 'adjusted') : 'rule';
        message.responseReason = message.responseSource === 'adjusted' ? reasons.adjusted : trace.reason;
        trace.reply = message.text; trace.audioId = message.audioId; trace.audioSrc = message.audioSrc;
        trace.intendedReply = message.emergencyAudio?.intendedText || '';
        if (!trace.candidateTexts?.length) trace.candidateTexts = [trace.intendedReply || message.text];
        if (trace.selectedId && trace.selectedId !== message.audioId) trace.route = 'LLM選択と異なる音声をアプリが採用';
        else if (trace.selectedId) trace.route = 'LLM選択をアプリが採用';
        else trace.route = '既存ルールで返答確定';
        if (trace.intendedReply) {
          trace.route = '非常用の返答で代替';
          trace.reason = message.emergencyAudio.reason === 'answer_target_unresolved' ? '最後の質問への回答を選定できず記録' : '適切な登録音声がないため不足を記録';
          message.responseReason = trace.reason;
        }
        message.decision = {answerTarget:trace.answerTarget || '',
          candidates:(trace.candidates || []).slice(0,16).map(c=>({id:c.id || '',text:c.text || ''})),
          selectedId:trace.selectedId || '', adoptedId:message.audioId || '',
          meaning:trace.meaning || '', evidence:trace.evidence || '', conditions:trace.conditions || [],
          route:trace.route || '', reason:trace.reason || ''};
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
      if (currentTrace) { currentTrace.candidates = request.candidates.map(c=>({id:c.id,text:c.text})); currentTrace.candidateTexts = request.candidates.map(c => c.text); currentTrace.route = 'LLM判定中'; renderTrace(); }
      if (request.text.length > 2000) { setReason(currentTrace,'input_limit'); return null; }
      status.textContent = '会話の流れから返答を選んでいます…';
      try {
        const response = await fetch(api('/api/select'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request), signal: AbortSignal.timeout(7000) });
        if (!response.ok) {setReason(currentTrace,'service_error');return null;}
        const data = await response.json();
        if (!toggle.checked) {setReason(currentTrace,'off');return null;}
        const choice = data.llm?.judgement;
        setReason(currentTrace,data.llm?.status !== 'ok' ? data.llm?.status : choice?.rejectedId ? 'topic_mismatch' : choice?.id==='rule' ? 'rule' : request.candidates.some(c=>c.id===choice?.id)?'selected':'candidate_missing');
        if (currentTrace) {
          if (currentTrace.staffMessage && data.llm?.status === 'ok' && choice) currentTrace.staffMessage.responseSource = 'analyzed';
          currentTrace.meaning = choice ? (labels[choice.kind] || choice.kind) + ' ／ ' + (labels[choice.topic] || choice.topic) : '判定取得なし';
          currentTrace.evidence = choice?.evidence;
          currentTrace.answerTarget = choice?.answerTarget || currentTrace.answerTarget;
          currentTrace.rejectedId = choice?.rejectedId;
          currentTrace.conditions = choice?.conditions;
          currentTrace.selected = choice?.rejectedId ? choice.rejectedId + '（意味と音声が不一致のため拒否）' : choice?.id || 'なし';
          currentTrace.selectedId = choice?.id !== 'rule' ? choice?.id : null;
          currentTrace.route = choice?.id === 'rule' ? 'LLM保留・不適合 → 既存ルール' : data.llm?.status === 'ok' ? 'アプリ適用待ち' : '既存ルール（' + (data.llm?.status || '応答なし') + '）';
          renderTrace();
        }
        const candidate = request.candidates.find(c => c.id === choice?.id);
        if (data.llm?.status === 'ok' && candidate) {
          status.textContent = `LLM選択：「${candidate.text}」（${(data.elapsedMs / 1000).toFixed(2)}秒）`;
          return { ...choice, id: candidate.id };
        }
        status.textContent = data.llm?.status === 'cooldown'
          ? '15秒間隔の利用制限のため、今回は既存ルールで応答します。'
          : `LLM選択を採用できませんでした（${data.llm?.status || '応答なし'}${choice?.id === 'rule' ? '・既存処理を選択' : ''}）。今回は既存ルールで応答します。`;
        // Preserve valid analysis on rule/unsupported candidates for the app's
        // checked fallback; selecting no audio is not the same as no analysis.
        return data.llm?.status === 'ok' && choice?.id === 'rule' ? choice : null;
      } catch (error) {
        setReason(currentTrace,['TimeoutError','AbortError'].includes(error?.name)?'timeout':'network_error');
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
