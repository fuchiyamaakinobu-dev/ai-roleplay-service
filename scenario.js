window.ROLEPLAY_SCENARIO = {
  id: "service-12month-visit-promotion",
  title: "12カ月点検・来店促進",
  customerName: "池田の斎藤様",
  serviceTime: "1時間程度",
  initialCustomerMessage: "池田の斎藤です。12カ月点検の案内が来たんですが、お願いできますか？",
  audio: {
    initial: "initial",
    serviceTimeQuestions: [
      "serviceTimeQuestion",
      "serviceTimeQuestion02",
      "serviceTimeQuestion03"
    ],
    pickupRequests: [
      "pickupRequest01",
      "pickupRequest02",
      "pickupRequest03",
      "pickupRequest04",
      "pickupRequest06",
      "pickupRequest07",
      "pickupRequest08",
      "pickupRequest09",
      "pickupRequest10"
    ],
    objections: {
      work: ["objectionWork", "objectionWork02", "objectionWork03"],
      distance: ["objectionDistance", "objectionDistance02", "objectionDistance03"],
      competitor: ["objectionCompetitor"],
      misunderstanding: ["objectionMisunderstanding", "objectionMisunderstanding02"],
      family: ["objectionFamily", "objectionFamily02"]
    },
    acceptedPickup: "acceptedPickup",
    pickupDetectedEnd: "pickupDetectedEnd",
    needsMoreContext: "needsMoreContext",
    possibleAgreements: ["possibleAgreement", "possibleAgreement02", "possibleAgreement03"],
    followUps: ["followUp", "followUp02", "followUp03"],
    closings: ["closing", "closing02"]
  },
  serviceTimeQuestions: [
    "点検ってどれぐらい時間がかかるんですか？",
    "1時間くらいで終わりますか？",
    "何時間ぐらいで終わりますか？"
  ],
  pickupRequests: [
    "出来れば車を取りに来てもらえませんか？",
    "職場に取りに来れますか？",
    "自宅に取りに来てほしいんですけど。",
    "仕事が忙しくて持っていく時間が無いので取りに来てもらいますか？",
    "職場の駐車場にカギを付けて置いておくので、持って行っていただけますか？",
    "通勤で使用しているので職場まで車を取りに来てほしいんですけど。",
    "自宅に置いておくので、持っていってもらえませんか？",
    "運転に自信が無いので取りに来て頂くことはできますか？",
    "畑が忙しくて持っていく時間が無いので取りに来てもらいますか？"
  ],
  objections: {
    work: {
      label: "仕事",
      customer: [
        "仕事があるので、なかなか店まで行けないんです。",
        "平日はちょっと難しいですね。",
        "夕方しか時間が取れないんですけど。"
      ],
      expected: "土日営業日、仕事前後の時間帯、希望日時を確認する"
    },
    distance: {
      label: "距離",
      customer: [
        "家から少し遠いので、持って行くのが大変なんです。",
        "そちらまで行くのが少し面倒なんですよね。",
        "遠いし運転に自信が無いので本別には行けません。"
      ],
      expected: "買い物予定、市内の別店舗、無理のない日程を提案する"
    },
    competitor: {
      label: "他店比較",
      customer: [
        "他のお店では取りに来てくれるって聞いたんですが。"
      ],
      expected: "引取を否定せず、来店メリットを選択肢として伝える"
    },
    misunderstanding: {
      label: "説明の食い違い",
      customer: [
        "取りに来てくれるって言いませんでした？",
        "自宅に取りに来るって言いませんでした？"
      ],
      expected: "認識違いを確認し、来店提案の理由と希望を再確認する"
    },
    family: {
      label: "家族相談",
      customer: [
        "主人と相談してみます。",
        "家族と相談してからでもいいですか？"
      ],
      expected: "無理に迫らず、再連絡時期と必要情報を整理する"
    }
  },
  progress: [
    { state: "START", label: "開始" },
    { state: "INSPECTION_REQUEST_RECEIVED", label: "点検受付" },
    { state: "SERVICE_TIME_QUESTION", label: "時間説明" },
    { state: "PICKUP_REQUEST", label: "引取依頼" },
    { state: "VISIT_PROPOSAL", label: "来店提案" },
    { state: "ALTERNATIVE_PROPOSAL", label: "代替案" }
  ],
  scoring: [
    { key: "acknowledged_request", label: "依頼を受け止めた", action: "依頼を受け止める", points: 10 },
    { key: "explained_service_time", label: "作業時間を説明した", action: "作業時間を説明する", points: 10 },
    { key: "asked_reason", label: "引取希望の理由を確認した", action: "引取希望の理由を確認する", points: 15 },
    { key: "explained_visit_benefit", label: "来店メリットを説明した", action: "来店メリットを説明する", points: 15 },
    { key: "proposed_weekend", label: "土日などを提案した", action: "土日などを提案する", points: 15 },
    { key: "proposed_other_store", label: "他店舗などを提案した", action: "他店舗などを提案する", points: 10 },
    { key: "left_choice", label: "選択肢を残した", action: "選択肢を残す", points: 10 },
    { key: "next_action_confirmed", label: "次の約束につなげた", action: "次の約束につなげる", points: 15 }
  ],
  recommendedTalk:
    "お仕事で平日のご来店が難しいのですね。点検だけですと1時間程度です。土日に営業している週もありますので、ご都合はいかがでしょうか。ご来店いただければ、点検内容をお車を見ながら詳しくご説明できます。",
  recommendedTalks: {
    work:
      "お仕事で平日のご来店が難しいのですね。点検は1時間程度です。土日営業日や、お仕事の前後で利用しやすい時間帯も確認できます。ご都合のよい曜日や時間帯を教えていただけますか。",
    distance:
      "ご自宅から距離があり、ご来店がご負担なのですね。お出かけの予定に合わせる方法や、ご自宅から近い店舗をご案内する方法もございます。無理のない方法を一緒に確認させてください。",
    competitor:
      "他店の引取サービスも比較されているのですね。引取のご希望を否定せず、ご来店いただく場合はお車を見ながら点検内容を詳しくご説明できる点も含めて、ご都合に合う方法をお選びいただけます。何を一番重視されていますか。",
    misunderstanding:
      "ご案内が分かりにくく、申し訳ございません。以前の説明内容と現在のご希望を確認させてください。そのうえで、来店またはほかの方法からご負担の少ない方法をご案内します。",
    family:
      "ご家族と相談されるのですね。もちろんお急ぎいただく必要はありません。ご相談に必要な点検時間や選択肢を整理し、こちらから再度ご連絡する時期を決めさせていただけますか。",
    drivingConfidence:
      "運転にご不安があるのですね。無理に運転なさらず、ご主人などご家族と一緒にご来店いただく方法や、ご自宅から近い店舗をご案内する方法もございます。どちらがご負担が少ないでしょうか。"
  }
};
