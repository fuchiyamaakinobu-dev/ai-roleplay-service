const byId = id => document.getElementById(id);
const messages = {
  disabled: '現在のルールだけで確認しました。LLMには送信していません。',
  not_configured: 'LLMは未接続です。現在のルールだけで確認しました。',
  cooldown: '無料枠の消費を抑えるため、LLMへの送信は30秒間隔です。現在のルールは利用できます。',
  daily_limit: '検証用の1日50回の上限に達しました。現在のルールは利用できます。',
  provider_limit: 'API側の利用制限に達したため、この検証環境からのLLM送信を24時間休止します。',
  provider_error: 'APIがリクエストを受け付けませんでした。キー・モデルの利用権限を確認してください。',
  timeout: 'LLMが6秒以内に応答しませんでした。現在のルールは利用できます。',
  network_error: 'LLMとの通信に失敗しました。現在のルールは利用できます。',
  invalid_output: 'LLMの回答形式または根拠を確認できず、判定を採用しませんでした。',
  busy: 'LLMが別の判定を処理しています。少し待ってからお試しください。',
  budget_error: '利用回数を確認できないため、LLMへの送信を停止しています。'
};
const verdict = { yes: '確認した', no: '確認していない', uncertain: '判断保留' };
async function refreshStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error();
    const data = await res.json();
    byId('live').disabled = !data.ready;
    if (!data.ready) byId('live').checked = false;
    byId('connection').textContent = data.ready
      ? `接続設定あり · ${data.model} · 本日の送信 ${data.used}/${data.limit}回（日本時間）`
      : 'LLMは未接続です。APIキーと無料プランの確認をサーバー側に設定すると比較できます。現在のルールはすぐに試せます。';
  } catch {
    byId('live').disabled = true;
    byId('live').checked = false;
    byId('connection').textContent = '検証サーバーに接続できません。起動状態を確認してください。';
  }
}
byId('example').addEventListener('change', e => { if (e.target.value) byId('utterance').value = e.target.value; });
byId('compareForm').addEventListener('submit', async e => {
  e.preventDefault();
  const text = byId('utterance').value.trim();
  if (!text) { byId('message').textContent = 'スタッフの発言を入力してください。'; return; }
  byId('submit').disabled = true;
  byId('message').textContent = '判定を確認しています…';
  for (const id of ['rule-service','llm-service','rule-concern','llm-concern']) {
    byId(id).textContent = '—'; byId(id).className = '';
  }
  byId('evidence').textContent = ''; byId('timing').textContent = '';
  try {
    const res = await fetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, live: byId('live').checked }), signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const evidence = [];
    let differences = 0;
    for (const [key, suffix, label] of [['service_request','service','追加作業'],['vehicle_concern','concern','車の気になる点']]) {
      byId(`rule-${suffix}`).textContent = data.baseline[key] ? '確認した' : '確認していない';
      if (data.llm.status === 'ok') {
        const item = data.llm.judgement[key];
        const cell = byId(`llm-${suffix}`);
        cell.textContent = verdict[item.verdict];
        if (item.verdict === 'uncertain' || (item.verdict === 'yes') !== data.baseline[key]) { cell.className = 'different'; differences++; }
        if (item.evidence) evidence.push(`${label}の根拠：「${item.evidence}」`);
      }
    }
    byId('message').textContent = data.llm.status === 'ok'
      ? (differences ? '判定に違いがあります。正しい理解か、原文と照らして確認してください。' : '今回の判定は一致しました。正しさは原文と照らして確認してください。')
      : (messages[data.llm.status] || 'LLMの判定を取得できませんでした。');
    byId('evidence').textContent = evidence.join('\n');
    if (data.elapsedMs) byId('timing').textContent = `LLM応答時間：${(data.elapsedMs / 1000).toFixed(2)}秒`;
  } catch { byId('message').textContent = '検証サーバーとの通信に失敗しました。入力を残していますので、接続後に再度お試しください。'; }
  finally { byId('submit').disabled = false; await refreshStatus(); }
});
refreshStatus();
