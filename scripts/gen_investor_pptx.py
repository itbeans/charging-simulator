from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

DARK_GREEN  = RGBColor(0x1B,0x43,0x32)
MID_GREEN   = RGBColor(0x2D,0x6A,0x4F)
ACCENT_GRN  = RGBColor(0x40,0x91,0x6C)
LIGHT_GREEN = RGBColor(0xD8,0xF3,0xDC)
YELLOW      = RGBColor(0xF9,0xC7,0x4F)
WHITE       = RGBColor(0xFF,0xFF,0xFF)
TEXT_DARK   = RGBColor(0x1B,0x2D,0x1F)
ROW_ALT     = RGBColor(0xF0,0xFA,0xF4)
ROW_HL      = RGBColor(0xD8,0xF3,0xDC)

prs = Presentation()
prs.slide_width  = Inches(13.33)
prs.slide_height = Inches(7.5)

def blank(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])

def rect(slide, x, y, w, h, rgb):
    s = slide.shapes.add_shape(1, x, y, w, h)
    s.fill.solid(); s.fill.fore_color.rgb = rgb
    s.line.fill.background(); return s

def txt(slide, text, x, y, w, h, size=14, bold=False, color=WHITE,
        align=PP_ALIGN.LEFT, font="Calibri", wrap=True):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame; tf.word_wrap = wrap
    p = tf.paragraphs[0]; p.alignment = align
    r = p.add_run(); r.text = text
    r.font.size = Pt(size); r.font.bold = bold
    r.font.color.rgb = color; r.font.name = font
    return tb

def slide_bg(s):
    W,H = prs.slide_width, prs.slide_height
    rect(s,0,0,W,H,DARK_GREEN)
    rect(s,0,0,Inches(0.18),H,YELLOW)
    rect(s,0,H-Inches(0.10),W,Inches(0.10),YELLOW)

def header_band(s, label, title):
    W = prs.slide_width
    rect(s,Inches(0.18),0,W,Inches(1.2),MID_GREEN)
    rect(s,Inches(0.18),Inches(1.2),W,Inches(0.06),YELLOW)
    txt(s,label,Inches(0.35),Inches(0.08),Inches(12),Inches(0.4),size=9,bold=True,color=YELLOW)
    txt(s,title,Inches(0.35),Inches(0.42),Inches(12.5),Inches(0.72),size=20,bold=True,color=WHITE)

def add_table(slide, headers, rows, x, y, w, h, ratios, highlight_rows=None):
    cols = len(headers)
    table = slide.shapes.add_table(len(rows)+1, cols, x, y, w, h).table
    col_widths = [int(w*r) for r in ratios]
    for i,cw in enumerate(col_widths): table.columns[i].width = cw

    def sc(cell, text, bg, fg, bold=False, sz=9):
        cell.fill.solid(); cell.fill.fore_color.rgb = bg
        tf = cell.text_frame; tf.word_wrap = True
        p = tf.paragraphs[0]; r = p.add_run()
        r.text = text; r.font.size = Pt(sz); r.font.bold = bold
        r.font.color.rgb = fg; r.font.name = "Calibri"

    for ci,h in enumerate(headers):
        sc(table.cell(0,ci),h,MID_GREEN,WHITE,bold=True,sz=10)
    for ri,row in enumerate(rows):
        hl = highlight_rows and ri in highlight_rows
        bg = ROW_HL if hl else (ROW_ALT if ri%2==0 else WHITE)
        for ci,cell_text in enumerate(row):
            is_bold = cell_text.startswith("**")
            t = cell_text.strip("*")
            fg = ACCENT_GRN if is_bold else TEXT_DARK
            sc(table.cell(ri+1,ci),t,bg,fg,bold=is_bold,sz=9)

W,H = prs.slide_width, prs.slide_height

# ── SLIDE 1: COVER ───────────────────────────────────────────────────────────
s = blank(prs); slide_bg(s)
rect(s,Inches(0.18),0,W,Inches(0.08),YELLOW)
txt(s,"INVESTOR ONE PAGER  ·  CONFIDENTIAL",Inches(0.35),Inches(0.15),Inches(12),Inches(0.5),
    size=9,bold=True,color=YELLOW)
txt(s,"EV Charger Simulator",Inches(0.4),Inches(1.5),Inches(12.5),Inches(1.2),
    size=44,bold=True,color=WHITE,align=PP_ALIGN.CENTER)
txt(s,"The software test infrastructure layer for an $11B EV charging management market.",
    Inches(0.4),Inches(2.9),Inches(12.5),Inches(0.8),size=18,color=LIGHT_GREEN,align=PP_ALIGN.CENTER)
txt(s,"OCPP 1.6J  ·  TypeScript / Node.js  ·  CI/CD Native  ·  Seed Round: $750K",
    Inches(0.4),Inches(3.75),Inches(12.5),Inches(0.6),size=13,color=YELLOW,align=PP_ALIGN.CENTER)
rect(s,Inches(4.5),Inches(4.8),Inches(4.3),Inches(0.55),MID_GREEN)
txt(s,"juiceupcharging.com",Inches(4.5),Inches(4.8),Inches(4.3),Inches(0.55),
    size=13,color=YELLOW,align=PP_ALIGN.CENTER)

# ── SLIDE 2: THE PROBLEM ─────────────────────────────────────────────────────
s = blank(prs); slide_bg(s)
header_band(s,"THE PROBLEM","EV charging grows at 35% YoY — testing infrastructure hasn't kept up.")

stats = [
    ("4M+",  "public charging points today","→ 40M projected by 2030  (IEA, 2024)"),
    ("€200K","max cost of a hardware test lab","€500–€5,000 per physical charger"),
    ("100s", "of incorrect invoices per day", "from a single billing defect across just 100 stations"),
    ("12 wk","hardware integration test cycle","per release, with physical equipment"),
]
cx = Inches(0.35)
for stat, label, sub in stats:
    rect(s,cx,Inches(1.5),Inches(3.0),Inches(2.2),MID_GREEN)
    rect(s,cx,Inches(1.5),Inches(3.0),Inches(0.07),YELLOW)
    txt(s,stat,cx+Inches(0.1),Inches(1.65),Inches(2.8),Inches(0.85),
        size=26,bold=True,color=YELLOW)
    txt(s,label,cx+Inches(0.1),Inches(2.55),Inches(2.8),Inches(0.5),
        size=11,bold=True,color=WHITE)
    txt(s,sub, cx+Inches(0.1),Inches(3.1), Inches(2.8),Inches(0.55),
        size=9,color=LIGHT_GREEN)
    cx += Inches(3.24)

txt(s,"Edge cases — concurrent sessions, firmware resets, billing failures — are nearly impossible to reproduce repeatably with hardware.",
    Inches(0.35),Inches(4.0),Inches(12.5),Inches(0.6),size=12,color=LIGHT_GREEN)
txt(s,'"The result: untested infrastructure going live, and real drivers paying the price."',
    Inches(0.35),Inches(4.7),Inches(12.5),Inches(0.5),size=11,bold=True,color=YELLOW)

# ── SLIDE 3: THE SOLUTION ─────────────────────────────────────────────────────
s = blank(prs); slide_bg(s)
header_band(s,"THE SOLUTION","A fully software-native OCPP 1.6J charger. No racks. No cables. No field engineers.")

cards = [
    ("ALL 19\nOCPP MESSAGES","BootNotification → StopTransaction\n+ all 12 server commands\nFull protocol fidelity"),
    ("FLEET MODE","500 virtual chargers\non a single laptop\nin under 10 seconds"),
    ("60× ACCELERATED\nTIME","60-minute session\ncompleted in\n60 real seconds"),
    ("CI/CD NATIVE","GitHub Actions, GitLab CI\nJenkins — drop-in\nzero config changes"),
]
cx = Inches(0.35)
for title,body in cards:
    rect(s,cx,Inches(1.5),Inches(3.0),Inches(3.2),MID_GREEN)
    rect(s,cx,Inches(1.5),Inches(3.0),Inches(0.07),YELLOW)
    txt(s,title,cx+Inches(0.12),Inches(1.65),Inches(2.78),Inches(0.95),
        size=13,bold=True,color=YELLOW)
    txt(s,body, cx+Inches(0.12),Inches(2.65),Inches(2.78),Inches(1.8),
        size=11,color=LIGHT_GREEN)
    cx += Inches(3.24)

txt(s,"TypeScript / Node.js  ·  WebSocket/JSON  ·  Docker  ·  Works with any ev-server deployment",
    Inches(0.35),Inches(5.0),Inches(12.5),Inches(0.5),size=10,color=YELLOW,align=PP_ALIGN.CENTER)

# ── SLIDE 4: MARKET OPPORTUNITY ───────────────────────────────────────────────
s = blank(prs); slide_bg(s)
header_band(s,"MARKET OPPORTUNITY","$2.9B today → $11.4B by 2030 at 25.5% CAGR  (MarketsandMarkets, 2024)")

add_table(s,
    ["Segment","2024","2030 Projected","CAGR"],
    [
        ["TAM — EV Charging Mgmt Software","$2.9B","**$11.4B**","25.5%"],
        ["SAM — DevTools & Test Infra for CSMS","~$90M","**~$400M**","~28%"],
        ["SOM — 200 paying accounts, 36 months","—","**~$4.6M ARR**","—"],
    ],
    Inches(0.35),Inches(1.4),Inches(12.6),Inches(1.9),[0.45,0.18,0.22,0.15],
    highlight_rows=[2]
)

why_nows = [
    ("300%", "IEA projected growth in charging points by 2030 — compressing test cycles every quarter"),
    ("$4.2B","invested in EV charging SaaS in 2023 — flush customers with testing budgets"),
    ("OCPP 2.0.1","global adoption wave creating new compliance & certification testing requirements"),
]
by = Inches(3.6)
for stat,label in why_nows:
    rect(s,Inches(0.35),by,Inches(1.8),Inches(0.65),MID_GREEN)
    txt(s,stat,Inches(0.35),by,Inches(1.8),Inches(0.65),size=16,bold=True,color=YELLOW,align=PP_ALIGN.CENTER)
    txt(s,label,Inches(2.3),by+Inches(0.12),Inches(10.5),Inches(0.45),size=11,color=LIGHT_GREEN)
    by += Inches(0.82)

txt(s,"WHY NOW",Inches(0.35),Inches(3.35),Inches(4),Inches(0.35),size=9,bold=True,color=YELLOW)

# ── SLIDE 5: BUSINESS MODEL ───────────────────────────────────────────────────
s = blank(prs); slide_bg(s)
header_band(s,"BUSINESS MODEL","SaaS tiers targeting CSMS vendors, network operators, and system integrators.")

add_table(s,
    ["Tier","Price","Includes"],
    [
        ["Developer","Free","Open-source core, community support, unlimited local simulation"],
        ["Pro","$299 / month","Unlimited fleet simulation, CI/CD webhooks, priority support, advanced scenarios"],
        ["Enterprise","**$2,499 / month**","Custom scenario scripting, SLA, white-label, dedicated CSM — Target ACV $18K–$30K"],
    ],
    Inches(0.35),Inches(1.4),Inches(12.6),Inches(2.0),[0.16,0.18,0.66],
    highlight_rows=[2]
)

txt(s,"PROJECTED ECONOMICS",Inches(0.35),Inches(3.65),Inches(6),Inches(0.4),size=9,bold=True,color=YELLOW)

metrics = [
    ("200 accounts","60% Pro / 40% Enterprise","~$4.6M ARR"),
    ("$18K–$30K","Target Enterprise ACV","land-and-expand model"),
    ("36 months","to SOM target","post-seed"),
]
cx = Inches(0.35)
for m,sub,note in metrics:
    rect(s,cx,Inches(4.1),Inches(3.9),Inches(1.5),MID_GREEN)
    txt(s,m,  cx+Inches(0.1),Inches(4.15),Inches(3.7),Inches(0.7),size=20,bold=True,color=YELLOW)
    txt(s,sub,cx+Inches(0.1),Inches(4.85),Inches(3.7),Inches(0.4),size=10,color=WHITE)
    txt(s,note,cx+Inches(0.1),Inches(5.3), Inches(3.7),Inches(0.35),size=9,color=LIGHT_GREEN)
    cx += Inches(4.2)

# ── SLIDE 6: COMPETITIVE DIFFERENTIATION ─────────────────────────────────────
s = blank(prs); slide_bg(s)
header_band(s,"COMPETITIVE DIFFERENTIATION","No direct competitor combines fleet simulation + accelerated time + full OCPP 1.6J in a CI/CD-ready tool.")

add_table(s,
    ["Capability","Manual / Wireshark","Partial OSS Mocks","EV Charger Simulator"],
    [
        ["Full OCPP 1.6J — all 19 message types","Partial","Partial","**All 19 message types**"],
        ["Fleet simulation (100+ chargers)","No","No","**Yes — 500+ on a laptop**"],
        ["Accelerated time (60× compression)","No","No","**Yes**"],
        ["CI/CD integration","No","Manual","**Native — GH Actions, GitLab, Jenkins**"],
        ["Repeatable edge-case scripting","No","Limited","**Yes — fully scriptable**"],
        ["Setup time","Days","Hours","**Under 5 minutes**"],
    ],
    Inches(0.35),Inches(1.4),Inches(12.6),Inches(3.4),[0.32,0.20,0.20,0.28]
)

# ── SLIDE 7: TRACTION & TECHNOLOGY ───────────────────────────────────────────
s = blank(prs); slide_bg(s)
header_band(s,"TRACTION & TECHNOLOGY","Production-ready today. Built on the proven open standard.")

items = [
    ("✅","OCPP 1.6J — all 19 message types","Full protocol fidelity — BootNotification through StopTransaction and every server command"),
    ("✅","ev-server integration","Apache-licensed; Fortune 500 energy operator deployments; 2,000+ GitHub stars"),
    ("✅","Fleet mode validated","500 simultaneous simulated chargers on a single VM — confirmed stable"),
    ("✅","CI/CD native","GitHub Actions, GitLab CI, Jenkins — drop into any pipeline in minutes, zero config changes"),
    ("✅","Horizontal scale","Laptop → CI runner → cloud VM: same codebase, no infrastructure changes"),
]
by = Inches(1.5)
for icon,title,detail in items:
    rect(s,Inches(0.35),by,Inches(12.6),Inches(0.75),MID_GREEN)
    txt(s,f"{icon}  {title}",Inches(0.45),by+Inches(0.05),Inches(4.5),Inches(0.42),
        size=12,bold=True,color=YELLOW)
    txt(s,detail,Inches(5.0),by+Inches(0.1),Inches(7.8),Inches(0.55),
        size=10,color=LIGHT_GREEN)
    by += Inches(0.88)

# ── SLIDE 8: USE OF FUNDS + MILESTONES ───────────────────────────────────────
s = blank(prs); slide_bg(s)
header_band(s,"USE OF FUNDS","Seed Round: $750,000")

add_table(s,
    ["Allocation","%","Amount","Use"],
    [
        ["Engineering","40%","$300K","OCPP 2.0.1 support, web-based scenario builder UI, managed SaaS platform"],
        ["Sales & Marketing","30%","$225K","EV SaaS vendor outreach, EV.Charging Summit, Charge Expo, content marketing"],
        ["Cloud Infrastructure","20%","$150K","Simulator-as-a-Service platform (multi-tenant, API-driven)"],
        ["Operations & Legal","10%","$75K","IP protection, compliance, administration"],
    ],
    Inches(0.35),Inches(1.4),Inches(12.6),Inches(2.2),[0.22,0.08,0.10,0.60]
)

txt(s,"18-MONTH MILESTONES POST-CLOSE",Inches(0.35),Inches(3.8),Inches(8),Inches(0.4),
    size=9,bold=True,color=YELLOW)

milestones = [
    ("Q2","OCPP 2.0.1 support shipped"),
    ("Q3","50 paying Pro accounts"),
    ("Q4","10 Enterprise contracts  ($180K+ ARR)"),
    ("Q6","SaaS platform beta live"),
]
cx = Inches(0.35)
for q,m in milestones:
    rect(s,cx,Inches(4.25),Inches(3.0),Inches(1.3),MID_GREEN)
    rect(s,cx,Inches(4.25),Inches(3.0),Inches(0.07),YELLOW)
    txt(s,q,cx+Inches(0.1),Inches(4.32),Inches(2.8),Inches(0.42),
        size=14,bold=True,color=YELLOW)
    txt(s,m,cx+Inches(0.1),Inches(4.8), Inches(2.8),Inches(0.65),
        size=10,color=WHITE)
    cx += Inches(3.18)

# ── SLIDE 9: VISION / CLOSE ───────────────────────────────────────────────────
s = blank(prs); slide_bg(s)
rect(s,Inches(0.18),0,W,Inches(0.08),YELLOW)
txt(s,"THE OPPORTUNITY",Inches(0.35),Inches(0.2),Inches(12),Inches(0.5),
    size=11,bold=True,color=YELLOW)
txt(s,"As EV adoption accelerates, the gap between infrastructure deployment speed\nand testing capability grows wider every quarter.",
    Inches(0.35),Inches(0.8),Inches(12.5),Inches(1.2),size=22,bold=True,color=WHITE,align=PP_ALIGN.CENTER)
txt(s,"The EV Charger Simulator closes that gap — making it possible to validate any charging network\nbefore it fails in the field, not after.",
    Inches(0.35),Inches(2.2),Inches(12.5),Inches(1.0),size=16,color=LIGHT_GREEN,align=PP_ALIGN.CENTER)
rect(s,Inches(1.5),Inches(3.4),Inches(10.3),Inches(0.9),MID_GREEN)
txt(s,'"The best time to find a bug in your billing engine is before your first driver gets an incorrect invoice."',
    Inches(1.6),Inches(3.45),Inches(10.1),Inches(0.8),size=13,bold=True,color=YELLOW,align=PP_ALIGN.CENTER)
txt(s,"The de facto testing standard for every OCPP deployment on earth.",
    Inches(0.35),Inches(4.6),Inches(12.5),Inches(0.6),size=18,bold=True,color=WHITE,align=PP_ALIGN.CENTER)
rect(s,Inches(4.2),Inches(5.5),Inches(5.0),Inches(0.7),YELLOW)
txt(s,"Seed Round: $750,000  |  Contact us",
    Inches(4.2),Inches(5.5),Inches(5.0),Inches(0.7),size=14,bold=True,color=DARK_GREEN,align=PP_ALIGN.CENTER)
txt(s,"juiceupcharging.com  ·  OCPP 1.6J  ·  TypeScript  ·  Confidential",
    Inches(0.35),Inches(6.8),Inches(12.5),Inches(0.4),size=9,color=ACCENT_GRN,align=PP_ALIGN.CENTER)

prs.save("/home/user/charging-simulator/INVESTOR_ONE_PAGER.pptx")
print("INVESTOR_ONE_PAGER.pptx generated")
