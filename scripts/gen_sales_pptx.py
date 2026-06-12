from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
import copy

DARK_GREEN  = RGBColor(0x1B, 0x43, 0x32)
MID_GREEN   = RGBColor(0x2D, 0x6A, 0x4F)
ACCENT_GRN  = RGBColor(0x40, 0x91, 0x6C)
LIGHT_GREEN = RGBColor(0xD8, 0xF3, 0xDC)
YELLOW      = RGBColor(0xF9, 0xC7, 0x4F)
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
TEXT_DARK   = RGBColor(0x1B, 0x2D, 0x1F)
ROW_ALT     = RGBColor(0xF0, 0xFA, 0xF4)

prs = Presentation()
prs.slide_width  = Inches(13.33)
prs.slide_height = Inches(7.5)

def blank_slide(prs):
    layout = prs.slide_layouts[6]  # blank
    return prs.slides.add_slide(layout)

def add_rect(slide, x, y, w, h, fill_rgb, transparency=0):
    from pptx.util import Pt
    shape = slide.shapes.add_shape(1, x, y, w, h)  # MSO_SHAPE_TYPE.RECTANGLE=1
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_rgb
    shape.line.fill.background()
    return shape

def add_text_box(slide, text, x, y, w, h, font_size=18, bold=False,
                 color=WHITE, align=PP_ALIGN.LEFT, font_name="Calibri"):
    txBox = slide.shapes.add_textbox(x, y, w, h)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = font_name
    return txBox

def slide_background(slide, prs):
    W, H = prs.slide_width, prs.slide_height
    add_rect(slide, 0, 0, W, H, DARK_GREEN)
    add_rect(slide, 0, 0, Inches(0.18), H, YELLOW)
    add_rect(slide, 0, H - Inches(0.12), W, Inches(0.12), YELLOW)

def add_table(slide, headers, rows, x, y, w, h, col_widths_ratio):
    cols = len(headers)
    table = slide.shapes.add_table(len(rows)+1, cols, x, y, w, h).table
    col_widths = [int(w * r) for r in col_widths_ratio]
    for i, cw in enumerate(col_widths):
        table.columns[i].width = cw

    def style_cell(cell, text, bg, fg, bold=False, size=10):
        cell.fill.solid()
        cell.fill.fore_color.rgb = bg
        tf = cell.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        run = p.add_run()
        run.text = text
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = fg
        run.font.name = "Calibri"

    for ci, h_text in enumerate(headers):
        style_cell(table.cell(0, ci), h_text, MID_GREEN, WHITE, bold=True, size=10)
    for ri, row in enumerate(rows):
        bg = ROW_ALT if ri % 2 == 0 else WHITE
        for ci, cell_text in enumerate(row):
            is_bold = cell_text.startswith("**")
            text = cell_text.strip("*")
            fg = ACCENT_GRN if is_bold else TEXT_DARK
            style_cell(table.cell(ri+1, ci), text, bg, fg, bold=is_bold, size=9)
    return table

# ── SLIDE 1: TITLE ──────────────────────────────────────────────────────────
s = blank_slide(prs)
W, H = prs.slide_width, prs.slide_height
slide_background(s, prs)
add_rect(s, Inches(0.18), 0, W, Inches(0.08), YELLOW)

add_text_box(s, "EV CHARGER SIMULATOR", Inches(0.4), Inches(1.8), Inches(12.5), Inches(1.2),
             font_size=44, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
add_text_box(s, "Test your EV charging network at any scale — before it goes live.",
             Inches(0.4), Inches(3.0), Inches(12.5), Inches(0.8),
             font_size=20, color=LIGHT_GREEN, align=PP_ALIGN.CENTER)
add_text_box(s, "Zero Hardware  ·  Zero Cost  ·  5-Minute Setup  ·  OCPP 1.6J Compliant",
             Inches(0.4), Inches(3.8), Inches(12.5), Inches(0.6),
             font_size=14, color=YELLOW, align=PP_ALIGN.CENTER)
add_rect(s, Inches(4.5), Inches(5.0), Inches(4.3), Inches(0.55), MID_GREEN)
add_text_box(s, "juiceupcharging.com", Inches(4.5), Inches(5.0), Inches(4.3), Inches(0.55),
             font_size=13, color=YELLOW, align=PP_ALIGN.CENTER)

# ── SLIDE 2: THE PROBLEM ─────────────────────────────────────────────────────
s = blank_slide(prs)
slide_background(s, prs)
add_rect(s, Inches(0.18), 0, W - Inches(0.18), Inches(1.3), MID_GREEN)
add_rect(s, Inches(0.18), Inches(1.3), W - Inches(0.18), Inches(0.06), YELLOW)
add_text_box(s, "THE PROBLEM", Inches(0.35), Inches(0.1), Inches(12), Inches(0.5),
             font_size=11, bold=True, color=YELLOW)
add_text_box(s, "Testing EV charging software with physical hardware is expensive, slow, and unscalable.",
             Inches(0.35), Inches(0.5), Inches(12), Inches(0.7),
             font_size=20, bold=True, color=WHITE)

bullets = [
    ("💸", "Hardware test lab: €50,000 – €200,000", "€500 – €5,000 per physical charger"),
    ("🕐", "Integration test cycles: 6–12 weeks", "per release cycle with physical equipment"),
    ("📊", "100s of incorrect invoices per day", "from a single billing defect across just 100 charging stations"),
    ("🔁", "Edge cases impossible to script", "concurrent sessions, resets, billing failures can't be reproduced reliably"),
    ("⚡", "500 incorrect invoices per day", "from a single billing bug across just 100 charging stations"),
]
by = Inches(1.6)
for icon, bold_text, rest in bullets:
    add_rect(s, Inches(0.35), by, Inches(12.5), Inches(0.7), MID_GREEN)
    add_text_box(s, f"{icon}  {bold_text}", Inches(0.45), by + Inches(0.05), Inches(6), Inches(0.35),
                 font_size=13, bold=True, color=YELLOW)
    add_text_box(s, rest, Inches(6.5), by + Inches(0.07), Inches(6.2), Inches(0.35),
                 font_size=12, color=LIGHT_GREEN)
    by += Inches(0.78)

# ── SLIDE 3: THE SOLUTION ─────────────────────────────────────────────────────
s = blank_slide(prs)
slide_background(s, prs)
add_rect(s, Inches(0.18), 0, W - Inches(0.18), Inches(1.3), MID_GREEN)
add_rect(s, Inches(0.18), Inches(1.3), W - Inches(0.18), Inches(0.06), YELLOW)
add_text_box(s, "THE SOLUTION", Inches(0.35), Inches(0.1), Inches(12), Inches(0.5),
             font_size=11, bold=True, color=YELLOW)
add_text_box(s, "A fully software-native OCPP 1.6J charger — no racks, no cables, no field engineers.",
             Inches(0.35), Inches(0.5), Inches(12), Inches(0.7),
             font_size=20, bold=True, color=WHITE)

cards = [
    ("ALL 19 OCPP\nMESSAGE TYPES", "BootNotification → StopTransaction\n+ all 12 server commands"),
    ("FLEET MODE", "500 virtual chargers\non a single laptop\nin under 10 seconds"),
    ("ACCELERATED\nTIME", "60-minute session\ncompleted in\n60 real seconds"),
    ("CI/CD NATIVE", "GitHub Actions\nGitLab CI · Jenkins\nDrop-in, zero config"),
]
cx = Inches(0.35)
for title, body in cards:
    add_rect(s, cx, Inches(1.55), Inches(3.0), Inches(2.5), MID_GREEN)
    add_rect(s, cx, Inches(1.55), Inches(3.0), Inches(0.06), YELLOW)
    add_text_box(s, title, cx + Inches(0.1), Inches(1.7), Inches(2.8), Inches(0.8),
                 font_size=13, bold=True, color=YELLOW)
    add_text_box(s, body, cx + Inches(0.1), Inches(2.55), Inches(2.8), Inches(1.3),
                 font_size=11, color=LIGHT_GREEN)
    cx += Inches(3.18)

add_text_box(s, "OCPP 1.6J  ·  TypeScript / Node.js  ·  WebSocket/JSON  ·  Docker ready  ·  Works with any ev-server deployment",
             Inches(0.35), Inches(4.3), Inches(12.5), Inches(0.5),
             font_size=10, color=YELLOW, align=PP_ALIGN.CENTER)

# ── SLIDE 4: FOUR MODES ──────────────────────────────────────────────────────
s = blank_slide(prs)
slide_background(s, prs)
add_rect(s, Inches(0.18), 0, W - Inches(0.18), Inches(1.0), MID_GREEN)
add_rect(s, Inches(0.18), Inches(1.0), W - Inches(0.18), Inches(0.06), YELLOW)
add_text_box(s, "FOUR MODES — EVERY TEST SCENARIO COVERED", Inches(0.35), Inches(0.25), Inches(12), Inches(0.65),
             font_size=22, bold=True, color=WHITE)

add_table(s,
    ["Mode", "What It Does", "Best For"],
    [
        ["boot",    "Connects, boots, stays live — responds to every dashboard command in real time", "Manual QA, remote command testing"],
        ["session", "Full Authorize → Start → MeterValues → Stop in seconds",                        "End-to-end billing validation"],
        ["multi",   "All connectors charging simultaneously",                                         "Smart charging, load balancing, per-connector billing"],
        ["fleet",   "10, 50, 100+ independent chargers running in parallel",                          "Load testing, stress testing, CI/CD regression suites"],
    ],
    Inches(0.35), Inches(1.3), Inches(12.6), Inches(2.8),
    [0.12, 0.5, 0.38]
)

add_text_box(s, "ACCELERATED TIME", Inches(0.35), Inches(4.4), Inches(6), Inches(0.45),
             font_size=13, bold=True, color=YELLOW)
add_text_box(s,
    "Set EV_SIM_ACCELERATED=true → 1 simulated minute = 1 real second.\n"
    "Validate billing, inactivity alerts & session timeouts in a coffee break.",
    Inches(0.35), Inches(4.9), Inches(12.5), Inches(0.9), font_size=12, color=LIGHT_GREEN)

# ── SLIDE 5: COMPARISON ───────────────────────────────────────────────────────
s = blank_slide(prs)
slide_background(s, prs)
add_rect(s, Inches(0.18), 0, W - Inches(0.18), Inches(1.0), MID_GREEN)
add_rect(s, Inches(0.18), Inches(1.0), W - Inches(0.18), Inches(0.06), YELLOW)
add_text_box(s, "REAL NUMBERS — SIMULATOR vs HARDWARE", Inches(0.35), Inches(0.25), Inches(12), Inches(0.65),
             font_size=22, bold=True, color=WHITE)

add_table(s,
    ["", "Physical Hardware", "EV Charger Simulator"],
    [
        ["Unit cost",            "€500 – €5,000",              "**€0**"],
        ["Test lab setup",       "Days to weeks",               "**Under 5 minutes**"],
        ["Concurrent chargers",  "Limited by hardware budget",  "**500+ on a single laptop**"],
        ["Session duration",     "Real time (60 min = 60 min)", "**60 min = 60 seconds**"],
        ["Edge case scripting",  "Manual, unreliable",          "**100% repeatable, fully scripted**"],
        ["CI/CD integration",    "Not possible",                "**Native — GH Actions, GitLab, Jenkins**"],
    ],
    Inches(0.35), Inches(1.2), Inches(12.6), Inches(3.5),
    [0.25, 0.38, 0.37]
)

# ── SLIDE 6: GET STARTED ─────────────────────────────────────────────────────
s = blank_slide(prs)
slide_background(s, prs)
add_rect(s, Inches(0.18), 0, W - Inches(0.18), Inches(1.3), MID_GREEN)
add_rect(s, Inches(0.18), Inches(1.3), W - Inches(0.18), Inches(0.06), YELLOW)
add_text_box(s, "GET STARTED IN UNDER 5 MINUTES", Inches(0.35), Inches(0.1), Inches(12), Inches(0.5),
             font_size=11, bold=True, color=YELLOW)
add_text_box(s, "Zero hardware. Zero cost. One command.",
             Inches(0.35), Inches(0.5), Inches(12), Inches(0.7),
             font_size=22, bold=True, color=WHITE)

cmds = [
    ("1", "Install & configure", "npm install && cp config.example.json config.json"),
    ("2", "Boot your virtual charger", "npm run dev boot"),
    ("3", "Run a full session (60× accelerated)", "EV_SIM_ID_TAG=AABBCCDD EV_SIM_ACCELERATED=true npm run dev session"),
    ("4", "Stress-test with 50 chargers", "EV_SIM_FLEET_COUNT=50 EV_SIM_ACCELERATED=true npm run dev fleet"),
]
by = Inches(1.55)
for num, label, cmd in cmds:
    add_rect(s, Inches(0.35), by, Inches(0.55), Inches(0.55), YELLOW)
    add_text_box(s, num, Inches(0.35), by, Inches(0.55), Inches(0.55),
                 font_size=16, bold=True, color=DARK_GREEN, align=PP_ALIGN.CENTER)
    add_text_box(s, label, Inches(1.05), by, Inches(3.5), Inches(0.35),
                 font_size=11, bold=True, color=LIGHT_GREEN)
    add_rect(s, Inches(4.65), by, Inches(8.2), Inches(0.55), MID_GREEN)
    add_text_box(s, cmd, Inches(4.8), by + Inches(0.08), Inches(8.0), Inches(0.4),
                 font_size=10, color=YELLOW, font_name="Courier New")
    by += Inches(0.72)

add_text_box(s,
    "OCPP 1.6J  ·  TypeScript  ·  Node.js  ·  Works with any ev-server  ·  Docker & CI/CD ready",
    Inches(0.35), Inches(6.5), Inches(12.5), Inches(0.5),
    font_size=10, color=ACCENT_GRN, align=PP_ALIGN.CENTER)
add_text_box(s, "juiceupcharging.com", Inches(0.35), Inches(6.9), Inches(12.5), Inches(0.4),
             font_size=11, bold=True, color=YELLOW, align=PP_ALIGN.CENTER)

prs.save("/home/user/charging-simulator/ONE_PAGER.pptx")
print("ONE_PAGER.pptx generated")
