from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "vehicle_inspection_roleplay_model_answer.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

FONT_DIR = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("Meiryo", FONT_DIR / "meiryo.ttc", subfontIndex=0))
pdfmetrics.registerFont(TTFont("Meiryo-Bold", FONT_DIR / "meiryob.ttc", subfontIndex=0))

NAVY = colors.HexColor("#0B2F63")
BLUE = colors.HexColor("#2563B9")
PALE_BLUE = colors.HexColor("#EAF2FF")
GREEN = colors.HexColor("#087F5B")
PALE_GREEN = colors.HexColor("#E9F8F1")
GOLD = colors.HexColor("#B76E00")
PALE_GOLD = colors.HexColor("#FFF6DC")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#5B6472")
LINE = colors.HexColor("#D7DFEA")

styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "TitleJP",
    parent=styles["Title"],
    fontName="Meiryo-Bold",
    fontSize=20,
    leading=28,
    textColor=NAVY,
    alignment=TA_CENTER,
    spaceAfter=5 * mm,
)
subtitle_style = ParagraphStyle(
    "SubtitleJP",
    parent=styles["Normal"],
    fontName="Meiryo",
    fontSize=9.5,
    leading=15,
    textColor=MUTED,
    alignment=TA_CENTER,
    spaceAfter=5 * mm,
)
heading_style = ParagraphStyle(
    "HeadingJP",
    parent=styles["Heading2"],
    fontName="Meiryo-Bold",
    fontSize=13,
    leading=19,
    textColor=NAVY,
    spaceBefore=2 * mm,
    spaceAfter=2.5 * mm,
)
body_style = ParagraphStyle(
    "BodyJP",
    parent=styles["BodyText"],
    fontName="Meiryo",
    fontSize=9.2,
    leading=15,
    textColor=INK,
)
small_style = ParagraphStyle(
    "SmallJP",
    parent=body_style,
    fontSize=8.3,
    leading=13,
    textColor=MUTED,
)
dialogue_style = ParagraphStyle(
    "DialogueJP",
    parent=body_style,
    fontSize=9.2,
    leading=15.5,
)
role_style = ParagraphStyle(
    "RoleJP",
    parent=body_style,
    fontName="Meiryo-Bold",
    fontSize=8.2,
    leading=12,
    alignment=TA_CENTER,
)


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(16 * mm, height - 13 * mm, width - 16 * mm, height - 13 * mm)
    canvas.setFont("Meiryo", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(16 * mm, height - 9.5 * mm, "AI接客ロープレ - 車検誘致・電話フォロー")
    canvas.drawRightString(width - 16 * mm, 9 * mm, f"{doc.page} / 模範解答")
    canvas.restoreState()


def info_box(title, text, background=PALE_BLUE, border=BLUE):
    data = [[Paragraph(f"<b>{title}</b>", body_style)], [Paragraph(text, body_style)]]
    table = Table(data, colWidths=[174 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.8, border),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, border),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ]
        )
    )
    return table


def dialogue_block(number, role, text):
    is_staff = role == "スタッフ"
    role_bg = PALE_BLUE if is_staff else PALE_GREEN
    role_fg = BLUE if is_staff else GREEN
    row_bg = colors.white if number % 2 else colors.HexColor("#F8FAFD")
    table = Table(
        [[
            Paragraph(f"{number}<br/>{role}", role_style),
            Paragraph(text, dialogue_style),
        ]],
        colWidths=[27 * mm, 147 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), role_bg),
                ("TEXTCOLOR", (0, 0), (0, 0), role_fg),
                ("BACKGROUND", (1, 0), (1, 0), row_bg),
                ("BOX", (0, 0), (-1, -1), 0.55, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
            ]
        )
    )
    return KeepTogether([table, Spacer(1, 1.3 * mm)])


dialogue = [
    ("AIお客様", "はい、もしもし。"),
    ("スタッフ", "佐藤様でしょうか。"),
    ("AIお客様", "そうです。"),
    ("スタッフ", "私、トヨタモビリティ帯広の○○と申します。日頃は大変お世話になり、誠にありがとうございます。"),
    ("AIお客様", "こちらこそ。"),
    ("スタッフ", "お使いのヤリスの車検満了日は9月30日で、8月1日以降作業可能です。ご予定はお決まりでしたでしょうか。"),
    ("AIお客様", "お願いします。"),
    ("スタッフ", "ありがとうございます。"),
    ("AIお客様", "どれくらい時間がかかるのですか？"),
    ("スタッフ", "基本作業は90分程度です。お車の調子や気になる点、オイル交換などのご希望はございますか。"),
    ("AIお客様", "オイル交換もお願いしたいです。"),
    ("スタッフ", "かしこまりました。現在の走行距離は何kmくらいでしょうか。"),
    ("AIお客様", "今、3万キロくらいです。"),
    ("スタッフ", "3万kmですね。オイル交換を含めても作業時間は変わらず90分程度です。店内でお待ちいただけますか。"),
    ("AIお客様", "出かける可能性があるので、一応代車を用意してほしいんですが、できますか？"),
    ("スタッフ", "かしこまりました。早めのご予約ですので、代車をご用意できます。"),
    ("AIお客様", "予約しようかな。"),
    ("スタッフ", "ありがとうございます。このまま予約手続きを進めます。10分程度お時間をいただきますが、よろしいでしょうか。"),
    ("AIお客様", "大丈夫ですよ。"),
    ("スタッフ", "8月30日午前10時はいかがでしょうか。"),
    ("AIお客様", "では、その日でお願いします。"),
    ("スタッフ", "かしこまりました。当日は、車内と荷室のお荷物を降ろした状態で、車検証、自賠責保険証明書、納税証明書をお持ちください。"),
    ("AIお客様", "はい。"),
    ("スタッフ", "ロックナットを使用している場合は、キーまたはアダプターもお持ちください。受付のため15分前にご来店をお願いいたします。"),
    ("AIお客様", "分かりました。"),
    ("スタッフ", "入庫日の3日前に確認のお電話をいたします。この携帯へのご連絡でよろしいでしょうか。"),
    ("AIお客様", "この携帯にお願いします。"),
    ("スタッフ", "佐藤様、8月30日午前10時、代車をご用意してお待ちしております。"),
    ("AIお客様", "お願いします。"),
    ("スタッフ", "本日はありがとうございました。当日はよろしくお願いいたします。"),
    ("AIお客様", "ありがとうございました。"),
]

story = [
    Spacer(1, 3 * mm),
    Paragraph("車検誘致・電話フォロー", title_style),
    Paragraph("100点を目指す最短の模範解答 - A4進行確認版", subtitle_style),
    info_box(
        "お客様情報",
        "佐藤様 / ヤリス / 車検満了日 9月30日 / 8月1日以降作業可能 / 想定走行距離 30,000km",
        PALE_GREEN,
        GREEN,
    ),
    Spacer(1, 4 * mm),
    Paragraph("この模範ルートの要点", heading_style),
]

points = [
    "本人確認、店舗・担当者名、日頃のお礼を冒頭でまとめて自然に行う。",
    "作業時間を尋ねられた後、車両状態とオイル交換を確認し、走行距離を作業時間の判断材料として聞く。",
    "オイル交換追加後は、作業時間が変わらないことを90分と再案内する。",
    "店内で待つかを確認し、お客様が代車を希望したら、手配を明確に承諾する。代車承諾後は待ち方を『代車利用』として保持する。",
    "予約手続きに10分程度かかる了承を得てから、具体的な月日と時刻を提示する。",
    "入庫日時確定後は前工程へ戻らず、持参品、ロックナット、15分前来店、3日前連絡、予約復唱、終話へ進む。",
]
point_rows = [[Paragraph(f"<b>{i}.</b>", body_style), Paragraph(text, body_style)] for i, text in enumerate(points, 1)]
point_table = Table(point_rows, colWidths=[9 * mm, 165 * mm])
point_table.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (0, -1), PALE_GOLD),
            ("TEXTCOLOR", (0, 0), (0, -1), GOLD),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
            ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ]
    )
)
story.extend(
    [
        point_table,
        Spacer(1, 4 * mm),
        info_box(
            "会話終了の最低条件",
            "具体的な入庫日と来店時刻の確定です。確定後は未確認項目へ後戻りせず終話できますが、省略項目は得点になりません。",
            PALE_GOLD,
            GOLD,
        ),
        Spacer(1, 4 * mm),
        Paragraph("矛盾を防ぐ記憶ルール", heading_style),
        Paragraph(
            "一度確認した作業時間、走行距離、オイル交換、代車、予約日時は保持します。代車の用意を承諾した後に店内待ちを再確認しません。"
            "また、日時確定後に前工程の質問を繰り返さず、未案内項目は採点だけに反映します。",
            body_style,
        ),
        Spacer(1, 4 * mm),
        info_box(
            "返答の固定ポイント",
            "代車承諾後: 『予約しようかな。』 / 予約手続き確認後: 『大丈夫ですよ。』 / 8月30日午前10時の提示後: 『では、その日でお願いします。』",
            PALE_BLUE,
            BLUE,
        ),
        PageBreak(),
        Paragraph("模範会話", title_style),
        Paragraph("スタッフ発話は、音声認識で判定しやすい具体語を残しながら、短く自然にまとめています。", subtitle_style),
    ]
)

for number, (role, text) in enumerate(dialogue, 1):
    story.append(dialogue_block(number, role, text))
    if number == 15:
        story.extend([PageBreak(), Paragraph("模範会話 - 予約確定から終話", title_style)])

doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=18 * mm,
    bottomMargin=16 * mm,
    title="車検誘致・電話フォロー 模範解答",
    author="AI接客ロープレ",
)
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUTPUT)
