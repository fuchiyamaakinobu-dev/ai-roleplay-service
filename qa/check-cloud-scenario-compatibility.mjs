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

const content = JSON.stringify({ scenarios: [publishedScenario] });
const appendedScripts = [];
const context = {
  window: {
    ROLEPLAY_SCENARIOS: [localScenario],
    ROLEPLAY_SCENARIO: localScenario,
    ROLEPLAY_AUDIO_DB: {
      items: [
        { id: "initial", text: "登録済み開始文", status: "ready" },
        { id: "serviceTimeQuestion", text: "登録済み時間質問", status: "ready" },
        { id: "pickupRequest01", text: "登録済み引取依頼", status: "ready" },
        { id: "objectionDistance", text: "登録済み距離", status: "ready" },
        { id: "objectionCompetitor", text: "登録済み他店比較", status: "ready" },
        { id: "appointmentSingleTime", text: "その時間でお願いします", status: "ready" }
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
assert.equal(appendedScripts.length, 1, "互換補正後にapp.jsが起動していません");

console.log("Firestore旧公開データ互換テスト: OK");
