(function loadPublishedRoleplayData() {
  const endpoint = "https://firestore.googleapis.com/v1/projects/ai-roleplay-editor/databases/(default)/documents/roleplay/public";
  const localScenarios = (window.ROLEPLAY_SCENARIOS || [
    window.ROLEPLAY_SCENARIO,
    window.VEHICLE_INSPECTION_SCENARIO
  ]).filter(Boolean);
  const audioItems = new Map(
    (window.ROLEPLAY_AUDIO_DB?.items || []).map((item) => [item.id, item])
  );

  function mergeMissingDefaults(defaultValue, publishedValue) {
    if (Array.isArray(defaultValue)) {
      return Array.isArray(publishedValue) ? publishedValue : defaultValue;
    }
    if (defaultValue && typeof defaultValue === "object") {
      const result = publishedValue && typeof publishedValue === "object"
        ? { ...publishedValue }
        : {};
      Object.entries(defaultValue).forEach(([key, value]) => {
        result[key] = mergeMissingDefaults(value, result[key]);
      });
      return result;
    }
    return publishedValue === undefined ? defaultValue : publishedValue;
  }

  function readyAudioText(audioId, fallbackText = "") {
    const item = audioItems.get(audioId);
    return item?.status === "ready" ? item.text : fallbackText;
  }

  function alignCustomerCandidates(scenario, textKey, audioKey) {
    const audioIds = scenario.audio?.[audioKey];
    if (!Array.isArray(audioIds)) return;
    const aligned = audioIds
      .map((audioId) => ({ audioId, item: audioItems.get(audioId) }))
      .filter(({ item }) => item?.status === "ready");
    scenario.audio[audioKey] = aligned.map(({ audioId }) => audioId);
    scenario[textKey] = aligned.map(({ item }) => item.text);
  }

  function normalize12MonthScenario(publishedScenario, localScenario) {
    const scenario = mergeMissingDefaults(localScenario, publishedScenario);
    scenario.audio = mergeMissingDefaults(localScenario.audio, publishedScenario.audio);

    alignCustomerCandidates(scenario, "serviceTimeQuestions", "serviceTimeQuestions");
    alignCustomerCandidates(scenario, "pickupRequests", "pickupRequests");

    Object.keys(scenario.audio?.objections || {}).forEach((key) => {
      const audioIds = scenario.audio.objections[key] || [];
      const aligned = audioIds
        .map((audioId) => ({ audioId, item: audioItems.get(audioId) }))
        .filter(({ item }) => item?.status === "ready");
      scenario.audio.objections[key] = aligned.map(({ audioId }) => audioId);
      if (scenario.objections?.[key]) {
        scenario.objections[key].customer = aligned.map(({ item }) => item.text);
      }
    });

    scenario.initialCustomerMessage = readyAudioText(
      scenario.audio?.initial,
      scenario.initialCustomerMessage
    );

    if (scenario.objections?.distance?.expected?.includes("買い物")) {
      scenario.objections.distance.expected = localScenario.objections.distance.expected;
    }
    if (scenario.recommendedTalks?.distance?.includes("お出かけの予定に合わせる")) {
      scenario.recommendedTalks.distance = localScenario.recommendedTalks.distance;
    }
    return scenario;
  }

  function normalizePublishedScenarios(publishedScenarios) {
    return publishedScenarios.map((publishedScenario) => {
      const localScenario = localScenarios.find((item) => item.id === publishedScenario.id);
      if (!localScenario) return publishedScenario;
      if (publishedScenario.id === "service-12month-visit-promotion") {
        return normalize12MonthScenario(publishedScenario, localScenario);
      }
      return mergeMissingDefaults(localScenario, publishedScenario);
    });
  }

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
      const normalizedScenarios = normalizePublishedScenarios(parsed.scenarios);
      window.ROLEPLAY_SCENARIOS = normalizedScenarios;
      window.ROLEPLAY_SCENARIO = normalizedScenarios[0];
      window.VEHICLE_INSPECTION_SCENARIO =
        normalizedScenarios.find((item) => item.mode === "staff-led-scripted") || normalizedScenarios[1];
      const status = document.querySelector("#connectionStatus");
      if (status) status.textContent = "クラウド公開データ";
    })
    .catch(() => {
      const status = document.querySelector("#connectionStatus");
      if (status) status.textContent = "ローカル判定モード";
    })
    .finally(startApp);
})();
