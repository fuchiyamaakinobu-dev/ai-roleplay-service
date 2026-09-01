(() => {
  "use strict";

  const entries = {
    confirmed_identity: {
      condition: "お客様名を含めて、本人かどうかを質問・確認する。",
      words: ["佐藤様", "佐藤さん", "斉藤様（音声誤認）", "お電話でしょうか", "ご本人ですか"],
      aliases: ["さとう → 佐藤", "さいとう → 斉藤"],
      invalid: ["お客様でしょうか", "佐藤様のお電話です"],
      note: "名前のない確認と、質問になっていない説明は未達です。"
    },
    introduced_self: {
      condition: "『トヨタ・モビリティ・帯広・本別（店）』などの店舗語に続く、登録されていない名前らしい語と名乗り語尾を確認する。個人名そのものは判定材料にしない。",
      words: ["トヨタ", "モビリティ", "帯広", "本別", "本別店", "トヨタモビリティ帯広本別店", "〈名前らしい未知語〉", "○○と申します", "○○と、もうします", "○○でございます", "○○と言います"],
      aliases: ["とよたもびりてぃ → トヨタモビリティ", "トヨタとモビリティ → トヨタモビリティ", "おびひろ → 帯広", "もうします → 申します"],
      invalid: ["トヨタモビリティ帯広です（担当者名なし）", "○○と申します（店舗名なし）", "店舗名だけ", "担当者名だけ"],
      note: "『寺屋』『寺谷』『山田』など具体的な個人名は辞書照合しません。店舗語の後ろに名前らしい未知語があり、その後に『申します／です／でございます／と言います』が続けば担当者名を名乗ったと判定します。店舗語と名乗り語尾だけで名前らしい語がない場合は未達です。"
    },
    thanked_customer: {
      condition: "日頃からの利用・関係に対するお礼を伝える。",
      words: ["いつもありがとうございます", "お世話になっております", "お世話になっています", "いつもお世話になってます", "日頃はお世話になりありがとうございます", "ご利用ありがとうございます", "ご愛顧に感謝します"],
      aliases: ["ごりよう → ご利用", "ごあいこ → ご愛顧", "かんしゃ → 感謝"],
      invalid: ["ありがとうございます", "お世話になります"],
      note: "会話途中の一般的なお礼や、今後の関係を表す『お世話になります』は日頃のお礼に含めません。"
    },
    explained_inspection_notice: {
      condition: "車種名と車検の案内・時期を説明する。",
      words: ["ヤリス", "車検", "時期", "近づいています", "9月30日"],
      aliases: ["やりす → ヤリス", "ヤルシス → ヤリス", "しゃけん → 車検"],
      invalid: ["車検のご案内です（車種なし）", "ヤリスの件です（車検なし）"],
      note: "車種と車検の用件が必要です。具体的な満了日は別の採点項目でも確認します。"
    },
    asked_availability: {
      condition: "車検予約の意思・予定・都合を質問する。",
      words: ["ご予定", "ご都合", "日程", "予約", "お決まり", "決められましたか", "いかがでしょうか", "ご都合の良い日を教えていただければと思います"],
      aliases: ["ごつごう → ご都合", "よてい → 予定", "にってい → 日程", "ご役 → 予約"],
      invalid: ["車検は決まりました", "ご予定のご案内です"],
      note: "疑問文だけでなく、『ご都合の良い日を教えてください／教えていただければと思います』のように希望日を求める依頼形も有効です。"
    },
    explained_available_period: {
      condition: "登録されている具体的な車検満了日を案内する。",
      words: ["9月30日", "9月30日まで", "満了日は9月30日"],
      aliases: ["くがつさんじゅうにち → 9月30日", "くがつの30日 → 9月30日", "まんりょう → 満了"],
      invalid: ["9月ごろ", "もうすぐ満了", "8月1日から作業できます（満了日なし）"],
      note: "このシナリオでは9月30日の具体値が必要です。作業可能日の説明は加点条件ではありません。"
    },
    explained_duration_and_wait: {
      condition: "会話全体で、現在の走行距離を質問し、対象の作業時間と店内待ち可能を説明する。",
      words: ["走行距離", "距離数", "何キロ", "何km", "60分", "75分", "90分", "1時間", "1時間15分", "1時間30分", "1時間半", "店内", "待てます"],
      aliases: ["そうこうきょり → 走行距離", "きょりすう → 距離数", "キュリー → 距離", "なんきろ → 何キロ", "九十分 → 90分"],
      invalid: ["3万キロです（質問なし）", "90分です（距離・待ち方なし）", "店内です（説明なし）"],
      note: "3条件は別々の発話でも合算します。走行距離は質問、店内待ちは説明または確認が必要です。"
    },
    explained_loaner: {
      condition: "通常は早期予約で代車を用意できると説明する。お客様が代車を希望した直後は、用意・準備・手配・依頼すると明確に承諾する。",
      words: ["代車", "代わりのお車", "代替車", "早めの予約", "用意できます", "ご準備します", "手配します", "ご依頼させていただきます", "空いてますよ", "大丈夫です"],
      aliases: ["だいしゃ → 代車", "代償 → 代車", "ようい → 用意", "じゅんび → 準備", "てはい → 手配", "いらい → 依頼", "だいじょうぶ → 大丈夫"],
      invalid: ["確認します", "用意できません", "空きがありません", "大丈夫ですか？", "大丈夫です（代車希望の文脈なし）"],
      note: "『代車を一応ご依頼させていただきます』も手配承諾として有効です。『大丈夫です』など代車を省略した肯定は、直前にお客様が代車を希望した場合だけ有効です。"
    },
    confirmed_booking_time: {
      condition: "予約手続きをこのまま続けてよいか、時間または手続きの文脈で了承を質問する。",
      words: ["10分程度", "もう少しお時間", "このまま予約", "予約手続き", "進めてもよろしいですか", "続けてもよろしいですか"],
      aliases: ["ご役 → 予約", "てつづき → 手続き", "じゅっぷん → 10分"],
      invalid: ["10分かかります", "予約を進めます", "大丈夫ですよ（スタッフの回答）"],
      note: "具体的な10分は必須ではありませんが、了承を求める質問が必要です。"
    },
    proposed_appointment: {
      condition: "具体的な月・日・時を1組そろえて提案する。",
      words: ["8月30日", "午前10時", "10時", "いかがでしょうか", "どうでしょうか"],
      aliases: ["はちがつさんじゅうにち → 8月30日", "ごぜんじゅうじ → 午前10時", "一日（ついたち）→ 1日"],
      invalid: ["8月30日（時刻なし）", "10時（年月日なし）", "土曜日の午前", "何時がよいですか"],
      note: "曜日や時間帯だけでは日時確定になりません。複数候補はお客様が1つ選ぶまで未確定です。"
    },
    confirmed_waiting: {
      condition: "店内で待つかを質問・確認する。または代車利用を明確に確定する。",
      words: ["店内でお待ちになりますか", "待っていただけますか", "店内で待てます", "代車をご用意します"],
      aliases: ["てんない → 店内", "だいしゃ → 代車"],
      invalid: ["店内待ちです", "待ち時間です", "代車を確認します"],
      note: "待ち方は質問・確認が必要です。代車手配の明確な承諾でも待ち方を確定します。"
    },
    asked_vehicle_concerns: {
      condition: "車の気になる点や調子について質問・確認する。",
      words: ["気になるところ", "調子が悪い", "不具合", "具合", "異音", "症状", "違和感", "オイル交換", "追加作業", "ご用命"],
      aliases: ["きになる → 気になる", "ふぐあい → 不具合", "ちょうし → 調子", "おいるこうかん → オイル交換", "ついかせいび → 追加整備"],
      invalid: ["気になる点です", "オイル交換ですね（ほかの希望確認なし）"],
      note: "対象語だけでなく、質問・確認の形が必要です。調子確認と追加作業確認は順不同で記憶します。"
    },
    explained_documents: {
      condition: "荷物を降ろす案内と、車検証・自賠責・納税証明書の3種類を案内する。",
      words: ["荷物を降ろす", "荷室を空に", "トランクを空に", "空荷", "車検証", "自賠責保険証明書", "納税証明書"],
      aliases: ["にもつ → 荷物", "しゃけんしょう → 車検証", "じばいせき → 自賠責", "のうぜいしょうめいしょ → 納税証明書"],
      invalid: ["必要書類をお持ちください", "車検証だけ", "荷物を降ろしてください（書類なし）"],
      note: "空荷案内と3書類は別々の発話でも会話全体で合算します。"
    },
    explained_lock_and_arrival: {
      condition: "ロックナットを外す用具と、10分前または15分前の早め来店を案内する。",
      words: ["ロックナットキー", "ロックキー", "アダプター", "専用工具", "外す工具", "外す道具", "10分前", "15分前", "早め"],
      aliases: ["ろっくなっと → ロックナット", "ろっくきー → ロックキー", "あだぷたー → アダプター", "せんようこうぐ → 専用工具"],
      invalid: ["工具を持参（ロックナット文脈なし）", "15分前だけ", "ロックナットキーだけ"],
      note: "用具と早め来店は別々の発話、逆順でも合算します。一般的な『工具』『キー』はロックナットの文脈が必要です。"
    },
    confirmed_reminder_contact: {
      condition: "入庫3日前の確認連絡を説明し、連絡先を質問・確認する。",
      words: ["3日前", "三日前", "確認のお電話", "連絡", "この携帯", "この電話", "今の電話", "この連絡先", "どちら", "電話番号"],
      aliases: ["さんにちまえ → 3日前", "みっかまえ → 3日前", "れんらく → 連絡", "けいたい → 携帯"],
      invalid: ["3日前に電話します（連絡先確認なし）", "この携帯です（3日前連絡なし）"],
      note: "3日前連絡の説明と連絡先確認の両方が必要です。『3日前に連絡します』→『こちらの携帯番号でよろしいですか』のように別々の発話でも会話全体で合算します。"
    },
    recapped_appointment: {
      condition: "お客様名と、確定済みの月・日・時を一致させて復唱し、予約・お待ち・よろしく等で締める。",
      words: ["佐藤様", "8月30日", "午前10時", "予約", "お待ちしております", "よろしくお願いいたします"],
      aliases: ["さとう → 佐藤", "月日のひらがな数詞 → 数字", "時刻のひらがな数詞 → 数字"],
      invalid: ["8月30日10時だけ（氏名なし）", "佐藤様、9月10日9時（確定日時と不一致）", "佐藤様、8月30日（時刻なし）"],
      note: "確定済み日時と異なる復唱は会話を止めませんが、この項目は未達です。"
    },
    closed_politely: {
      condition: "過去形の感謝を伝えて丁寧に終話する。",
      words: ["ありがとうございました", "本日はありがとうございました"],
      aliases: ["ありがとうございます（現在形）と区別"],
      invalid: ["ありがとうございます", "よろしくお願いいたします"],
      note: "『ありがとうございます』は会話途中でも使うため終話判定にしません。"
    }
  };

  const aliasGroups = [
    { title: "店舗・氏名", from: ["とよたもびりてぃ", "豊田モビリティ", "トヨタとモビリティ", "おびひろ", "もうします", "さとう", "さいとう"], to: ["トヨタモビリティ", "帯広", "申します", "佐藤", "斉藤"] },
    { title: "車種・車検", from: ["やりす", "ヤルシス", "しゃけん", "てんけん", "まんりょう"], to: ["ヤリス", "車検", "点検", "満了"] },
    { title: "予約・都合", from: ["ごつごう", "つごう", "よてい", "にってい", "よやく", "ご役", "てつづき"], to: ["ご都合", "都合", "予定", "日程", "予約", "手続き"] },
    { title: "走行距離・時間", from: ["そうこうきょり", "きょりすう", "キュリー", "なんきろ", "九十分", "一時間半"], to: ["走行距離", "距離数", "何キロ", "90分", "1時間半"] },
    { title: "代車", from: ["だいしゃ", "代償", "ようい", "じゅんび", "てはい", "だいじょうぶ"], to: ["代車", "用意", "準備", "手配", "大丈夫"] },
    { title: "車両状態・追加作業", from: ["きになる", "ふぐあい", "ちょうし", "ぐあい", "いおん", "しょうじょう", "いわかん", "おいるこうかん", "ついかせいび", "ごようめい"], to: ["気になる", "不具合", "調子", "具合", "異音", "症状", "違和感", "オイル交換", "追加整備", "ご用命"] },
    { title: "必要書類・荷物", from: ["にもつ", "しゃけんしょう", "じばいせき", "のうぜいしょうめいしょ"], to: ["荷物", "車検証", "自賠責", "納税証明書"] },
    { title: "ロックナット", from: ["ろっくなっと", "ろっくなっときー", "ろっくきー", "あだぷたー", "せんようこうぐ", "こうぐ", "どうぐ"], to: ["ロックナット", "ロックナットキー", "ロックキー", "アダプター", "専用工具", "工具", "道具"] },
    { title: "事前連絡", from: ["さんにちまえ", "みっかまえ", "れんらく", "けいたい", "でんわばんごう"], to: ["3日前", "連絡", "携帯", "電話番号"] },
    { title: "日付・時刻", from: ["はちがつ", "ついたち", "さんじゅうにち", "ごぜん", "ごご", "じゅうじ", "じゅっぷん"], to: ["8月", "1日", "30日", "午前", "午後", "10時", "10分"] }
  ];

  const scenario = window.VEHICLE_INSPECTION_SCENARIO;
  const scoring = scenario?.scoring || [];
  const scoreRoot = document.getElementById("scoreGlossary");
  const aliasRoot = document.getElementById("aliasGlossary");
  const search = document.getElementById("glossarySearch");
  const resultCount = document.getElementById("resultCount");
  const emptyMessage = document.getElementById("emptyMessage");
  let activeFilter = "all";

  scoreRoot.innerHTML = scoring.map((metric, index) => renderScoreCard(metric, index)).join("");
  aliasRoot.innerHTML = aliasGroups.map(renderAliasCard).join("");

  document.querySelector(".filter-buttons").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    applyFilter();
  });
  search.addEventListener("input", applyFilter);
  applyFilter();

  function renderScoreCard(metric, index) {
    const entry = entries[metric.key];
    if (!entry) return "";
    const searchable = [metric.label, metric.action, entry.condition, ...entry.words, ...entry.aliases, ...entry.invalid, entry.note].join(" ");
    return `<details class="glossary-card searchable-item" data-kind="score" data-search="${escapeHtml(normalizeSearch(searchable))}">
      <summary>
        <span class="card-number">${index + 1}</span>
        <span class="card-title"><strong>${escapeHtml(metric.label)}</strong><small>${escapeHtml(metric.action)}</small></span>
        <span class="points">${metric.points}点</span>
      </summary>
      <div class="card-body">
        <p class="condition"><strong>達成条件：</strong>${escapeHtml(entry.condition)}</p>
        ${renderWordGroup("認識する言葉・表現", entry.words, "")}
        ${renderWordGroup("似た言葉・音声認識補正", entry.aliases, "alias")}
        ${renderWordGroup("これだけでは不足・判定しない例", entry.invalid, "invalid")}
        <p class="note">${escapeHtml(entry.note)}</p>
      </div>
    </details>`;
  }

  function renderAliasCard(group) {
    const searchable = [group.title, ...group.from, ...group.to].join(" ");
    return `<article class="alias-card searchable-item" data-kind="alias" data-search="${escapeHtml(normalizeSearch(searchable))}">
      <h3>${escapeHtml(group.title)}</h3>
      <div class="chips">${group.from.map((word) => `<span class="chip alias">${escapeHtml(word)}</span>`).join("")}</div>
      <p class="alias-arrow">判定時に標準表記へ補正 ↓</p>
      <div class="chips">${group.to.map((word) => `<span class="chip">${escapeHtml(word)}</span>`).join("")}</div>
    </article>`;
  }

  function renderWordGroup(title, words, className) {
    return `<section class="word-group"><h4>${escapeHtml(title)}</h4><div class="chips">${words.map((word) => `<span class="chip ${className}">${escapeHtml(word)}</span>`).join("")}</div></section>`;
  }

  function applyFilter() {
    const query = normalizeSearch(search.value);
    let visibleCount = 0;
    document.querySelectorAll(".searchable-item").forEach((item) => {
      const kindMatches = activeFilter === "all" || item.dataset.kind === activeFilter;
      const queryMatches = !query || item.dataset.search.includes(query);
      const visible = kindMatches && queryMatches;
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    document.querySelectorAll("[data-section]").forEach((section) => {
      const kind = section.dataset.section;
      section.hidden = activeFilter !== "all" && activeFilter !== kind;
    });
    resultCount.textContent = `${visibleCount}件を表示`;
    emptyMessage.hidden = visibleCount > 0;
  }

  function normalizeSearch(value) {
    return String(value || "").toLowerCase().replace(/[\s　、。,.・/／()（）「」『』!?！？]/g, "");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    })[char]);
  }
})();
