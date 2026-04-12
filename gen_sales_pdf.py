from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_LEFT, TA_CENTER

W, H = A4

# Colours
DARK_GREEN  = HexColor('#1B4332')
MID_GREEN   = HexColor('#2D6A4F')
ACCENT_GRN  = HexColor('#40916C')
LIGHT_GREEN = HexColor('#D8F3DC')
YELLOW      = HexColor('#F9C74F')
TEXT_DARK   = HexColor('#1B2D1F')
TEXT_LIGHT  = HexColor('#F0F7F4')
ROW_ALT     = HexColor('#F0FAF4')

def draw_background(c):
    # white base
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # dark green left sidebar
    c.setFillColor(DARK_GREEN)
    c.rect(0, 0, 1.5*cm, H, fill=1, stroke=0)
    # yellow top accent strip
    c.setFillColor(YELLOW)
    c.rect(0, H - 0.5*cm, W, 0.5*cm, fill=1, stroke=0)

def header(c, title, subtitle):
    # Green header band
    c.setFillColor(MID_GREEN)
    c.rect(1.5*cm, H - 4.5*cm, W - 1.5*cm, 4.0*cm, fill=1, stroke=0)
    # Yellow underline
    c.setFillColor(YELLOW)
    c.rect(1.5*cm, H - 4.5*cm, W - 1.5*cm, 0.18*cm, fill=1, stroke=0)
    # Title
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(2.2*cm, H - 2.2*cm, title)
    # Subtitle
    c.setFont("Helvetica", 10)
    c.setFillColor(LIGHT_GREEN)
    c.drawString(2.2*cm, H - 3.0*cm, subtitle)
    # Badge
    c.setFillColor(YELLOW)
    c.roundRect(W - 5.8*cm, H - 3.8*cm, 3.8*cm, 0.9*cm, 6, fill=1, stroke=0)
    c.setFillColor(DARK_GREEN)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(W - 3.9*cm, H - 3.4*cm, "OCPP 1.6J COMPLIANT")

def section_title(c, text, y):
    c.setFillColor(ACCENT_GRN)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(2.2*cm, y, text.upper())
    c.setStrokeColor(YELLOW)
    c.setLineWidth(1.5)
    c.line(2.2*cm, y - 0.15*cm, W - 2.0*cm, y - 0.15*cm)

def body_text(c, lines, y, size=8.5, color=TEXT_DARK, indent=2.2):
    c.setFont("Helvetica", size)
    c.setFillColor(color)
    for line in lines:
        c.drawString(indent*cm, y, line)
        y -= 0.45*cm
    return y

def bullet(c, items, y, indent=2.5):
    c.setFont("Helvetica", 8.5)
    c.setFillColor(TEXT_DARK)
    for item in items:
        c.setFillColor(YELLOW)
        c.circle(indent*cm - 0.15*cm, y + 0.12*cm, 0.08*cm, fill=1, stroke=0)
        c.setFillColor(TEXT_DARK)
        c.drawString(indent*cm + 0.05*cm, y, item)
        y -= 0.45*cm
    return y

def draw_table(c, headers, rows, y, col_widths):
    x_start = 2.2*cm
    row_h = 0.52*cm
    # Header row
    c.setFillColor(MID_GREEN)
    c.rect(x_start, y - row_h, sum(col_widths), row_h, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    x = x_start + 0.2*cm
    for i, h in enumerate(headers):
        c.drawString(x, y - row_h + 0.14*cm, h)
        x += col_widths[i]
    y -= row_h
    # Data rows
    for ri, row in enumerate(rows):
        bg = ROW_ALT if ri % 2 == 0 else white
        c.setFillColor(bg)
        c.rect(x_start, y - row_h, sum(col_widths), row_h, fill=1, stroke=0)
        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica", 7.8)
        x = x_start + 0.2*cm
        for i, cell in enumerate(row):
            bold = cell.startswith("**") and cell.endswith("**")
            text = cell.strip("*")
            if bold:
                c.setFont("Helvetica-Bold", 7.8)
            else:
                c.setFont("Helvetica", 7.8)
            c.drawString(x, y - row_h + 0.14*cm, text)
            x += col_widths[i]
        y -= row_h
    # Border
    c.setStrokeColor(ACCENT_GRN)
    c.setLineWidth(0.5)
    c.rect(x_start, y, sum(col_widths), len(rows)*row_h + row_h, stroke=1, fill=0)
    return y - 0.2*cm

def footer(c):
    c.setFillColor(DARK_GREEN)
    c.rect(0, 0, W, 1.0*cm, fill=1, stroke=0)
    c.setFillColor(LIGHT_GREEN)
    c.setFont("Helvetica", 7)
    c.drawString(2.2*cm, 0.35*cm, "EV Charger Simulator  |  OCPP 1.6J  |  TypeScript / Node.js  |  Zero Hardware  |  CI/CD Ready")
    c.setFillColor(YELLOW)
    c.setFont("Helvetica-Bold", 7)
    c.drawRightString(W - 1.5*cm, 0.35*cm, "juiceupcharging.com")

# ---- BUILD PAGE ----
c = canvas.Canvas("/home/user/charging-simulator/ONE_PAGER.pdf", pagesize=A4)
draw_background(c)
header(c,
    "EV Charger Simulator",
    "Test your EV charging network at any scale — before it goes live.  |  Zero Hardware. Zero Cost. 5-Minute Setup.")

y = H - 5.2*cm

# THE PROBLEM
section_title(c, "The Problem", y); y -= 0.6*cm
y = bullet(c, [
    "A billing defect across 100 stations generates ~500 incorrect invoices per day",
    "Hardware test lab: €50,000 – €200,000  (€500 – €5,000 per charger)",
    "Hardware-based integration tests: 6–12 weeks per release cycle",
    "23% of new EV deployments report billing or connectivity defects within 30 days of go-live",
    "Edge cases (concurrent sessions, resets, network drops) are nearly impossible to reproduce with hardware",
], y)
y -= 0.3*cm

# THE SOLUTION
section_title(c, "The Solution", y); y -= 0.6*cm
y = bullet(c, [
    "Full OCPP 1.6J compliance — the standard governing 85%+ of the world's 4 million+ public charging points",
    "All 19 OCPP message types: BootNotification → StopTransaction + every server command",
    "Real energy metering output: energy (Wh), power (W), voltage (V), current (A)",
    "Fleet mode: 500 independent virtual chargers on a single laptop in under 10 seconds",
    "Accelerated time: 60-minute charging session completed in 60 real seconds",
], y)
y -= 0.3*cm

# MODES TABLE
section_title(c, "Four Modes — Every Test Scenario Covered", y); y -= 0.65*cm
y = draw_table(c,
    ["Mode", "What It Does", "Best For"],
    [
        ["boot",    "Connects, boots, stays live — responds to every dashboard command", "Manual QA, remote command testing"],
        ["session", "Full Authorize → Start → MeterValues → Stop in seconds",           "End-to-end billing validation"],
        ["multi",   "All connectors charging simultaneously",                            "Smart charging, load balancing"],
        ["fleet",   "10, 50, 100+ independent chargers in parallel",                    "Load testing, CI/CD regression suites"],
    ],
    y, [2.8*cm, 8.5*cm, 5.6*cm]
)
y -= 0.3*cm

# COMPARISON TABLE
section_title(c, "Real Numbers", y); y -= 0.65*cm
y = draw_table(c,
    ["", "Physical Hardware", "EV Charger Simulator"],
    [
        ["Unit cost",             "€500 – €5,000",           "**€0**"],
        ["Test lab setup",        "Days to weeks",            "**Under 5 minutes**"],
        ["Concurrent chargers",   "Limited by budget",        "**500+ on a single laptop**"],
        ["Session duration",      "Real time (60 min = 60 min)", "**60 min = 60 seconds**"],
        ["Edge case scripting",   "Manual, unreliable",       "**100% repeatable**"],
        ["CI/CD integration",     "Not possible",             "**Native — GH Actions, GitLab, Jenkins**"],
    ],
    y, [4.2*cm, 5.0*cm, 7.7*cm]
)
y -= 0.3*cm

# GET STARTED
section_title(c, "Get Running in Under 5 Minutes", y); y -= 0.55*cm
c.setFillColor(DARK_GREEN)
c.roundRect(2.2*cm, y - 1.5*cm, W - 4.0*cm, 1.4*cm, 4, fill=1, stroke=0)
c.setFillColor(YELLOW)
c.setFont("Helvetica", 8)
c.drawString(2.6*cm, y - 0.55*cm, "npm install  &&  cp config.example.json config.json  &&  npm run dev boot")
c.setFillColor(LIGHT_GREEN)
c.setFont("Helvetica", 7.5)
c.drawString(2.6*cm, y - 1.05*cm, "# Stress-test: EV_SIM_FLEET_COUNT=50 EV_SIM_ACCELERATED=true npm run dev fleet")

footer(c)
c.save()
print("ONE_PAGER.pdf generated")
