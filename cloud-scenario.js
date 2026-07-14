(function loadPublishedRoleplayData() {
  const endpoint = "https://firestore.googleapis.com/v1/projects/ai-roleplay-editor/databases/(default)/documents/roleplay/public";

  function startApp() {
    const script = document.createElement("script");
    script.src = "./app.js";
    document.body.appendChild(script);
  }

  fetch(endpoint, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`Firestore ${response.status}`);
      return response.json();
    })
    .then((documentData) => {
      const content = documentData?.fields?.content?.stringValue;
      if (!content) throw new Error("公開データが空です");
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) {
        throw new Error("シナリオ形式が正しくありません");
      }
      window.ROLEPLAY_SCENARIOS = parsed.scenarios;
      window.ROLEPLAY_SCENARIO = parsed.scenarios[0];
      window.VEHICLE_INSPECTION_SCENARIO =
        parsed.scenarios.find((item) => item.mode === "staff-led-scripted") || parsed.scenarios[1];
      const status = document.querySelector("#connectionStatus");
      if (status) status.textContent = "クラウド公開データ";
    })
    .catch(() => {
      const status = document.querySelector("#connectionStatus");
      if (status) status.textContent = "ローカル判定モード";
    })
    .finally(startApp);
})();
