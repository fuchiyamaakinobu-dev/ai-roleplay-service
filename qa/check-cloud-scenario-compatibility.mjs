import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../cloud-scenario.js", import.meta.url), "utf8");

const localScenario = {
  id: "service-12month-visit-promotion",
  mode: "customer-led-branching",
  initialCustomerMessage: "ローカル開始文",
  serviceTimeQuestions: ["ローカル時間質問"],
  pickupRequests: ["ローカル引取依頼"],
  objections: {
    distance: { customer: ["ローカル距離"], expected: "近い店舗または家族との来店" },
    competitor: { customer: ["ローカル他店比較"] }
  },
  recommendedTalks: {
    distance: "近い店舗または家族との来店をご案内します。"
  },
  scoring: [
    { key: "asked_reason", label: "引取事情を受け止めた", action: "引取希望の事情を受け止める", points: 13 }
  ],
  audio: {
    initial: "initial",
    serviceTimeQuestions: ["serviceTimeQuestion"],
    pickupRequests: ["pickupRequest01"],
    objections: {
      distance: ["objectionDistance"],
      competitor: ["objectionCompetitor"]
    },
    appointmentSingleTime: "appointmentSingleTime"
  }
};

const publishedScenario = {
  ...structuredClone(localScenario),
  initialCustomerMessage: "古い開始文",
  objections: {
    distance: { customer: ["古い距離"], expected: "買い物予定、市内の別店舗を提案する" },
    competitor: {
      customer: ["他店比較1", "音声IDのない古い他店比較2"]
    }
  },
  recommendedTalks: {
    distance: "お出かけの予定に合わせる方法をご案内します。"
  },
  scoring: [
    { key: "asked_reason", label: "引取希望の理由を確認した", action: "引取希望の理由を確認する", points: 13 }
  ],
  audio: {
    initial: "initial",
    serviceTimeQuestions: ["serviceTimeQuestion"],
    pickupRequests: ["pickupRequest01"],
    objections: {
      distance: ["objectionDistance"],
      competitor: ["objectionCompetitor"]
    }
  }
};

const localInspectionScenario = {
  id: "vehicle-inspection-phone-followup",
  mode: "staff-led-scripted",
  title: "車検誘致・電話フォロー",
  steps: [
    {
      key: "asked_vehicle_concerns",
      customerResponse: "オイル交換もお願いしたいです。",
      retryResponse: "ほかに確認することはありますか？",
      optionalAfterAppointment: true
    },
    {
      key: "recapped_appointment",
      customerResponse: "お願いします。",
      retryResponse: "ん！？、何日の予定でしたっけ？",
      optionalAfterAppointment: true
    }
  ]
};

const publishedInspectionScenario = {
  ...structuredClone(localInspectionScenario),
  steps: [
    {
      key: "asked_vehicle_concerns",
      customerResponse: "別にないです。",
      retryResponse: "ほかに確認することはありますか？"
    },
    {
      key: "recapped_appointment",
      customerResponse: "お願いします。",
      retryResponse: "最後に予約内容をもう一度お願いします。"
    }
  ]
};

const content = JSON.stringify({ scenarios: [publishedScenario, publishedInspectionScenario] });
const appendedScripts = [];
const context = {
  window: {
    ROLEPLAY_SCENARIOS: [localScenario, localInspectionScenario],
    ROLEPLAY_SCENARIO: localScenario,
    ROLEPLAY_AUDIO_DB: {
      items: [
        { id: "initial", text: "登録済み開始文", status: "ready" },
        { id: "serviceTimeQuestion", text: "登録済み時間質問", status: "ready" },
        { id: "pickupRequest01", text: "登録済み引取依頼", status: "ready" },
        { id: "objectionDistance", text: "登録済み距離", status: "ready" },
        { id: "objectionCompetitor", text: "登録済み他店比較", status: "ready" },
        { id: "appointmentSingleTime", text: "その時間でお願いします", status: "ready" },
        {
          id: "inspection_asked_vehicle_concerns_customer",
          text: "オイル交換もお願いしたいです。",
          status: "ready"
        },
        {
          id: "inspection_asked_vehicle_concerns_retry",
          text: "ほかに確認することはありますか？",
          status: "ready"
        },
        {
          id: "inspection_recapped_appointment_customer",
          text: "お願いします。",
          status: "ready"
        },
        {
          id: "inspection_recapped_appointment_retry",
          text: "ん！？、何日の予定でしたっけ？",
          status: "ready"
        }
      ]
    }
  },
  document: {
    createElement() {
      return {};
    },
    body: {
      appendChild(script) {
        appendedScripts.push(script);
      }
    },
    querySelector() {
      return { textContent: "" };
    }
  },
  fetch: async () => ({
    ok: true,
    json: async () => ({ fields: { content: { stringValue: content } } })
  }),
  Map,
  JSON,
  Error,
  Promise
};

vm.createContext(context);
vm.runInContext(source, context);
await new Promise((resolve) => setTimeout(resolve, 0));

const normalized = context.window.ROLEPLAY_SCENARIOS[0];
assert.equal(normalized.initialCustomerMessage, "登録済み開始文");
assert.deepEqual([...normalized.serviceTimeQuestions], ["登録済み時間質問"]);
assert.deepEqual([...normalized.pickupRequests], ["登録済み引取依頼"]);
assert.deepEqual([...normalized.objections.competitor.customer], ["登録済み他店比較"]);
assert.deepEqual([...normalized.audio.objections.competitor], ["objectionCompetitor"]);
assert.equal(normalized.audio.appointmentSingleTime, "appointmentSingleTime");
assert.equal(normalized.objections.distance.expected, localScenario.objections.distance.expected);
assert.equal(normalized.recommendedTalks.distance, localScenario.recommendedTalks.distance);
assert.equal(normalized.scoring[0].label, "引取事情を受け止めた");
assert.equal(normalized.scoring[0].action, "引取希望の事情を受け止める");
assert.equal(appendedScripts.length, 1, "互換補正後にapp.jsが起動していません");
assert.equal(
  appendedScripts[0].src,
  "./app.js?v=20260829-5",
  "公開更新後もブラウザーキャッシュから古いapp.jsを読み込む可能性があります"
);

const normalizedInspection = context.window.ROLEPLAY_SCENARIOS[1];
assert.equal(
  normalizedInspection.steps[0].customerResponse,
  "オイル交換もお願いしたいです。",
  "公開Firestoreの旧発話が車検誘致の登録済みMP3文へ補正されません"
);
assert.equal(normalizedInspection.steps[0].optionalAfterAppointment, true);
assert.equal(
  normalizedInspection.steps[1].retryResponse,
  "ん！？、何日の予定でしたっけ？",
  "予約復唱の旧聞き返しが登録済みMP3文へ補正されません"
);
assert.equal(normalizedInspection.steps[1].optionalAfterAppointment, true);

console.log("Firestore旧公開データ互換テスト: OK");
