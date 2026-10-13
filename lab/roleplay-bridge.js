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
  label.append(toggle, ' LLMで言い換えを理解する（12カ月点検・検証用）');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = '接続設定を確認しています。';
  const note = document.createElement('p');
  note.textContent = 'ONにすると、既存ルールが認識できない発言をGroqへ送信します。個人情報を含まない練習文を使ってください。音声は既存MP3、採点は既存ルールです。この検証版は履歴をクラウド保存しません。';
  panel.append(label, status, note);
  document.querySelector('.topbar').after(panel);
  window.ROLEPLAY_INTENT_ASSIST = {
    enabled: () => toggle.checked && !toggle.disabled,
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
    status.textContent = data.ready ? '接続済み。チェックを入れると利用できます（1日50回・30秒間隔）。' : 'API未接続。既存ルールで練習できます。';
  }).catch(() => { status.textContent = '接続を確認できません。既存ルールで練習できます。'; });
})();
