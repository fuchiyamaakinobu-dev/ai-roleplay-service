window.ROLEPLAY_SCENARIO = {
  id: "service-12month-visit-promotion",
  mode: "customer-led-branching",
  type: "サービス工場",
  title: "12カ月点検・来店促進",
  description: "追加整備・気になる症状を確認し、引取納車依頼を来店メリットと代替案へつなげる練習",
  customerName: "池田の斎藤様",
  serviceTime: "1時間程度",
  initialCustomerMessage: "池田の斎藤です。12カ月点検の案内が来たんですが、お願いできますか？",
  audio: {
    initial: "initial",
    additionalServiceRequest: "additionalServiceRequest",
    additionalServiceNone: "additionalServiceNone",
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
    { state: "ADDITIONAL_SERVICE_REQUEST", label: "追加整備確認" },
    { state: "ADDITIONAL_SERVICE_RECONFIRMATION", label: "追加整備再確認" },
    { state: "SERVICE_TIME_QUESTION", label: "時間説明" },
    { state: "PICKUP_REQUEST", label: "引取依頼" },
    { state: "VISIT_PROPOSAL", label: "来店提案" },
    { state: "ALTERNATIVE_PROPOSAL", label: "代替案" },
    { state: "APPOINTMENT_CONFIRMATION", label: "日時確認" }
  ],
  scoring: [
    { key: "acknowledged_request", label: "依頼を受け止めた", action: "依頼を受け止める", points: 8 },
    { key: "asked_additional_service", label: "その他ご用命・気になる点", action: "点検以外のご用命と気になる点を確認する", points: 15 },
    { key: "explained_service_time", label: "作業時間を説明した", action: "作業時間を説明する", points: 8 },
    { key: "asked_reason", label: "引取希望の理由を確認した", action: "引取希望の理由を確認する", points: 13 },
    { key: "explained_visit_benefit", label: "来店メリットを説明した", action: "来店メリットを説明する", points: 13 },
    { key: "proposed_weekend", label: "土日などを提案した", action: "土日などを提案する", points: 13 },
    { key: "proposed_other_store", label: "他店舗などを提案した", action: "他店舗などを提案する", points: 8 },
    { key: "left_choice", label: "選択肢を残した", action: "選択肢を残す", points: 8 },
    { key: "next_action_confirmed", label: "次の約束につなげた", action: "次の約束につなげる", points: 14 }
  ],
  recommendedTalk:
    "12カ月点検のほかに、オイル交換などのご用命や、その他お車で気になる点はございませんか。お仕事で平日のご来店が難しいのですね。点検だけですと1時間程度です。土日に営業している週もありますので、ご都合はいかがでしょうか。ご来店いただければ、点検内容をお車を見ながら詳しくご説明できます。",
  recommendedTalks: {
    work:
      "12カ月点検のほかに、オイル交換などのご用命や、その他お車で気になる点はございませんか。お仕事で平日のご来店が難しいのですね。点検は1時間程度です。土日営業日や、お仕事の前後で利用しやすい時間帯も確認できます。ご都合のよい曜日や時間帯を教えていただけますか。",
    distance:
      "12カ月点検のほかに、オイル交換などのご用命や、その他お車で気になる点はございませんか。ご自宅から距離があり、ご来店がご負担なのですね。お出かけの予定に合わせる方法や、ご自宅から近い店舗をご案内する方法もございます。無理のない方法を一緒に確認させてください。",
    competitor:
      "12カ月点検のほかに、オイル交換などのご用命や、その他お車で気になる点はございませんか。他店の引取サービスも比較されているのですね。引取のご希望を否定せず、ご来店いただく場合はお車を見ながら点検内容を詳しくご説明できる点も含めて、ご都合に合う方法をお選びいただけます。何を一番重視されていますか。",
    misunderstanding:
      "12カ月点検のほかに、オイル交換などのご用命や、その他お車で気になる点はございませんか。ご案内が分かりにくく、申し訳ございません。以前の説明内容と現在のご希望を確認させてください。そのうえで、来店またはほかの方法からご負担の少ない方法をご案内します。",
    family:
      "12カ月点検のほかに、オイル交換などのご用命や、その他お車で気になる点はございませんか。ご家族と相談されるのですね。もちろんお急ぎいただく必要はありません。ご相談に必要な点検時間や選択肢を整理し、こちらから再度ご連絡する時期を決めさせていただけますか。",
    drivingConfidence:
      "12カ月点検のほかに、オイル交換などのご用命や、その他お車で気になる点はございませんか。運転にご不安があるのですね。無理に運転なさらず、ご主人などご家族と一緒にご来店いただく方法や、ご自宅から近い店舗をご案内する方法もございます。どちらがご負担が少ないでしょうか。"
  }
};

window.VEHICLE_INSPECTION_SCENARIO = {
  id: "vehicle-inspection-phone-followup",
  mode: "staff-led-scripted",
  type: "車検誘致・上級",
  title: "車検誘致・電話フォロー",
  description: "スタッフの発話から始め、最低限の確認で予約を確定し、補足案内で得点を高める練習",
  customerName: "佐藤様",
  vehicleName: "ヤリス",
  expiryDate: "9月30日",
  availableFrom: "8月1日",
  appointmentDate: "8月20日10時",
  startInstruction: "電話がつながりました。顧客情報は『佐藤様／ヤリス／車検満了日9月30日／8月1日以降作業可能』です。スタッフから『佐藤様でしょうか』と本人確認を始めてください。",
  progress: [
    { state: "PHONE_OPENING", label: "本人確認・名乗り" },
    { state: "INSPECTION_GUIDANCE", label: "車検のご案内" },
    { state: "SERVICE_EXPLANATION", label: "時間・代車説明" },
    { state: "RESERVATION", label: "予約確定" },
    { state: "VEHICLE_CHECK", label: "車両・持参物" },
    { state: "FINAL_CONFIRMATION", label: "事前連絡・復唱" }
  ],
  scoring: [
    { key: "confirmed_identity", label: "本人確認", action: "お客様のお名前を確認する", points: 4 },
    { key: "introduced_self", label: "店舗・担当者名", action: "店舗名と担当者名を名乗る", points: 6 },
    { key: "thanked_customer", label: "日頃の利用へのお礼", action: "日頃のご利用への感謝を伝える", points: 4 },
    { key: "explained_inspection_notice", label: "車種・車検時期", action: "車種と車検時期を説明する", points: 8 },
    { key: "asked_availability", label: "都合確認", action: "お客様のご都合を確認する", points: 5 },
    { key: "explained_available_period", label: "満了日・入庫可能日", action: "満了日と作業可能日を案内する", points: 7 },
    { key: "explained_duration_and_wait", label: "作業時間・店内待ち", action: "基本作業時間と店内で待てることを説明する", points: 7 },
    { key: "explained_loaner", label: "代車予約", action: "早期予約で代車を用意できることを説明する", points: 6 },
    { key: "confirmed_booking_time", label: "予約手続き時間", action: "予約手続きに必要な時間の了承を得る", points: 5 },
    { key: "proposed_appointment", label: "具体的な日時", action: "具体的な予約日時を提案する", points: 8 },
    { key: "confirmed_waiting", label: "待ち方確認", action: "店内で待つか確認する", points: 4 },
    { key: "asked_vehicle_concerns", label: "気になる症状", action: "車の気になる点を確認する", points: 6 },
    { key: "explained_documents", label: "荷物・必要書類", action: "荷物の積み下ろしと必要書類を案内する", points: 8 },
    { key: "explained_lock_and_arrival", label: "ロックナット・早着", action: "ロックナットアダプターと15分前来店を案内する", points: 7 },
    { key: "confirmed_reminder_contact", label: "3日前確認連絡", action: "3日前の確認連絡と連絡先を確認する", points: 6 },
    { key: "recapped_appointment", label: "予約復唱", action: "お客様名と予約日時を復唱する", points: 5 },
    { key: "closed_politely", label: "終話あいさつ", action: "感謝を伝えて丁寧に終話する", points: 4 }
  ],
  steps: [
    {
      state: "PHONE_OPENING",
      key: "confirmed_identity",
      expected: "お客様名を呼び、本人か確認する",
      requiredGroups: [["佐藤", "斉藤"], ["でしょうか", "ですか"]],
      customerResponse: "そうです。",
      retryResponse: "どちらにお掛けですか？"
    },
    {
      state: "PHONE_OPENING",
      key: "introduced_self",
      expected: "店舗名と担当者名を名乗る",
      requiredGroups: [["トヨタモビリティ", "トヨタ"], ["です", "申します"]],
      customerResponse: "お世話になっております。",
      retryResponse: "どちら様でしょうか？"
    },
    {
      state: "PHONE_OPENING",
      key: "thanked_customer",
      expected: "日頃の利用へのお礼を伝える",
      requiredGroups: [["ご利用", "ご愛顧"], ["ありがとう", "感謝"]],
      advanceOnFailure: true,
      customerResponse: "こちらこそ。",
      retryResponse: "はい。"
    },
    {
      state: "INSPECTION_GUIDANCE",
      key: "explained_inspection_notice",
      expected: "車種と車検時期を説明する",
      requiredGroups: [["ヤリス"], ["車検"], ["近", "時期"]],
      customerResponse: "案内のはがきが来ていましたよ。",
      retryResponse: "はい？ ご用件は何ですか？"
    },
    {
      state: "INSPECTION_GUIDANCE",
      key: "asked_availability",
      expected: "車検の都合を確認する",
      requiredGroups: [["ご都合", "予定", "日程"]],
      customerResponse: "お願いしたいんですけど、いつできますか？",
      retryResponse: "それで、どうしたらいいですか？"
    },
    {
      state: "INSPECTION_GUIDANCE",
      key: "explained_available_period",
      expected: "満了日と作業可能日を案内する",
      requiredGroups: [["9月30日"], ["8月1日"], ["作業", "車検", "入庫"]],
      customerResponse: "どれくらい時間がかかるのですか？",
      retryResponse: "いつから車検を受けられるのですか？"
    },
    {
      state: "SERVICE_EXPLANATION",
      key: "explained_duration_and_wait",
      expected: "基本作業は1時間程度で、店内待ちも可能と伝える",
      requiredGroups: [["1時間", "一時間", "60分"], ["待", "店内"]],
      customerResponse: "代車は貸してもらえますか？",
      retryResponse: "どれくらい時間がかかるのですか？"
    },
    {
      state: "SERVICE_EXPLANATION",
      key: "explained_loaner",
      expected: "早めの予約で代車を用意できると伝える",
      requiredGroups: [["代車"], ["早め", "お早め"], ["予約"], ["用意", "ご用意"]],
      customerResponse: "予約しようかな。",
      retryResponse: "代車を用意してもらえますか？"
    },
    {
      state: "SERVICE_EXPLANATION",
      key: "confirmed_booking_time",
      expected: "予約手続きに10分程度かかることを伝え、了承を得る",
      requiredGroups: [["10分", "十分"], ["時間", "お時間"], ["よろしい", "大丈夫"]],
      customerResponse: "大丈夫ですよ。",
      retryResponse: "今、このまま予約できますか？"
    },
    {
      state: "RESERVATION",
      key: "proposed_appointment",
      expected: "具体的な月日と時間を提案する",
      requiredGroups: [["月"], ["日"], ["時"], ["いかが", "どうでしょう"]],
      customerResponse: "では、その日でお願いします。",
      retryResponse: "具体的な日時を教えてください。"
    },
    {
      state: "RESERVATION",
      key: "confirmed_waiting",
      expected: "店内で待つか確認する",
      requiredGroups: [["待"]],
      optionalAfterAppointment: true,
      customerResponse: "待っています。",
      retryResponse: "代車を借りるのと、待つのと、どちらですか？"
    },
    {
      state: "VEHICLE_CHECK",
      key: "asked_vehicle_concerns",
      expected: "車を使用していて気になる点がないか確認する",
      requiredGroups: [["気になる", "不具合", "調子", "具合"]],
      optionalAfterAppointment: true,
      customerResponse: "別にないです。",
      retryResponse: "ほかに確認することはありますか？"
    },
    {
      state: "VEHICLE_CHECK",
      key: "explained_documents",
      expected: "荷物を降ろし、納税証明書・車検証・自賠責を用意するよう案内する",
      requiredGroups: [["荷物"], ["納税証明"], ["車検証"], ["自賠責"]],
      optionalAfterAppointment: true,
      customerResponse: "はい。",
      retryResponse: "当日に必要な物を教えてください。"
    },
    {
      state: "VEHICLE_CHECK",
      key: "explained_lock_and_arrival",
      expected: "ロックナットアダプターと15分前来店を案内する",
      requiredGroups: [["ロック", "ホイールナット"], ["アダプター"], ["15分", "十五分"], ["早め", "前に"]],
      optionalAfterAppointment: true,
      customerResponse: "分かりました。",
      retryResponse: "ほかに持って行く物や、到着時間の注意はありますか？"
    },
    {
      state: "FINAL_CONFIRMATION",
      key: "confirmed_reminder_contact",
      expected: "作業3日前の確認連絡と、希望する連絡先を確認する",
      requiredGroups: [["3日前", "三日前"], ["連絡"], ["どちら", "携帯", "電話番号"]],
      optionalAfterAppointment: true,
      customerResponse: "この携帯にお願いします。",
      retryResponse: "事前の確認連絡はありますか？"
    },
    {
      state: "FINAL_CONFIRMATION",
      key: "recapped_appointment",
      expected: "お客様名と予約日時を復唱する",
      requiredGroups: [["佐藤"], ["月"], ["日"], ["時"], ["お待ち", "予約", "よろしく"]],
      optionalAfterAppointment: true,
      customerResponse: "お願いします。",
      retryResponse: "最後に予約内容をもう一度お願いします。"
    },
    {
      state: "FINAL_CONFIRMATION",
      key: "closed_politely",
      expected: "感謝を伝えて丁寧に電話を終える",
      requiredGroups: [["ありがとう"]],
      customerResponse: "ありがとうございました。",
      retryResponse: "はい。"
    }
  ],
  recommendedTalk:
    "本人確認、店舗名と担当者名、車種と車検時期を伝え、具体的な入庫日時を確定することが最低限の条件です。日時確定後は終話へ進めます。高得点を目指す場合は、お礼、満了日と入庫可能日、所要時間、代車、待ち方、車の気になる点、必要書類、ロックナット、15分前来店、3日前確認連絡、予約日時の復唱まで案内してください。"
};

window.ROLEPLAY_SCENARIOS = [
  window.ROLEPLAY_SCENARIO,
  window.VEHICLE_INSPECTION_SCENARIO
];
