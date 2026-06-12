from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas

W, H = A4

DARK_GREEN  = HexColor('#1B4332')
MID_GREEN   = HexColor('#2D6A4F')
ACCENT_GRN  = HexColor('#40916C')
LIGHT_GREEN = HexColor('#D8F3DC')
YELLOW      = HexColor('#F9C74F')
TEXT_DARK   = HexColor('#1B2D1F')
ROW_ALT     = HexColor('#F0FAF4')
ROW_HIGHLIGHT = HexColor('#D8F3DC')

def bg(c):
    c.setFillColor(white); c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(DARK_GREEN); c.rect(0,0,1.5*cm,H,fill=1,stroke=0)
    c.setFillColor(YELLOW); c.rect(0,H-0.5*cm,W,0.5*cm,fill=1,stroke=0)

def header(c):
    c.setFillColor(MID_GREEN); c.rect(1.5*cm,H-4.8*cm,W-1.5*cm,4.3*cm,fill=1,stroke=0)
    c.setFillColor(YELLOW); c.rect(1.5*cm,H-4.8*cm,W-1.5*cm,0.18*cm,fill=1,stroke=0)
    c.setFillColor(white); c.setFont("Helvetica-Bold",18)
    c.drawString(2.2*cm, H-2.0*cm, "EV Charger Simulator — Investor One Pager")
    c.setFont("Helvetica-Bold",11); c.setFillColor(YELLOW)
    c.drawString(2.2*cm, H-2.8*cm, "The software test infrastructure layer for an $11B charging management market")
    c.setFont("Helvetica",9); c.setFillColor(LIGHT_GREEN)
    c.drawString(2.2*cm, H-3.5*cm, "OCPP 1.6J  ·  TypeScript / Node.js  ·  CI/CD Native  ·  Seed Stage")
    # Tag
    c.setFillColor(YELLOW); c.roundRect(W-5.2*cm,H-4.3*cm,3.2*cm,0.8*cm,5,fill=1,stroke=0)
    c.setFillColor(DARK_GREEN); c.setFont("Helvetica-Bold",8)
    c.drawCentredString(W-3.6*cm,H-3.95*cm,"SEED ROUND: $750K")

def sec(c, text, y):
    c.setFillColor(ACCENT_GRN); c.setFont("Helvetica-Bold",8.5)
    c.drawString(2.2*cm, y, text.upper())
    c.setStrokeColor(YELLOW); c.setLineWidth(1.4)
    c.line(2.2*cm, y-0.15*cm, W-2.0*cm, y-0.15*cm)

def bul(c, items, y, indent=2.5):
    c.setFont("Helvetica",8.2); c.setFillColor(TEXT_DARK)
    for item in items:
        c.setFillColor(YELLOW); c.circle(indent*cm-0.15*cm,y+0.12*cm,0.08*cm,fill=1,stroke=0)
        c.setFillColor(TEXT_DARK); c.drawString(indent*cm+0.05*cm,y,item); y-=0.44*cm
    return y

def tbl(c, headers, rows, y, cols):
    x0=2.2*cm; rh=0.48*cm
    c.setFillColor(MID_GREEN); c.rect(x0,y-rh,sum(cols),rh,fill=1,stroke=0)
    c.setFillColor(white); c.setFont("Helvetica-Bold",8); x=x0+0.15*cm
    for i,h in enumerate(headers): c.drawString(x,y-rh+0.13*cm,h); x+=cols[i]
    y-=rh
    for ri,row in enumerate(rows):
        highlight = any("**" in cell for cell in row)
        bg_c = ROW_HIGHLIGHT if highlight else (ROW_ALT if ri%2==0 else white)
        c.setFillColor(bg_c); c.rect(x0,y-rh,sum(cols),rh,fill=1,stroke=0)
        x=x0+0.15*cm
        for i,cell in enumerate(row):
            bold=cell.startswith("**"); txt=cell.strip("*")
            c.setFont("Helvetica-Bold" if bold else "Helvetica",7.6)
            c.setFillColor(ACCENT_GRN if bold else TEXT_DARK)
            c.drawString(x,y-rh+0.12*cm,txt); x+=cols[i]
        y-=rh
    c.setStrokeColor(ACCENT_GRN); c.setLineWidth(0.4)
    c.rect(x0,y,sum(cols),len(rows)*rh+rh,stroke=1,fill=0)
    return y-0.2*cm

def footer(c):
    c.setFillColor(DARK_GREEN); c.rect(0,0,W,1.0*cm,fill=1,stroke=0)
    c.setFillColor(LIGHT_GREEN); c.setFont("Helvetica",7)
    c.drawString(2.2*cm,0.35*cm,"Confidential — EV Charger Simulator  |  Seed Stage  |  OCPP 1.6J  |  TypeScript / Node.js")
    c.setFillColor(YELLOW); c.setFont("Helvetica-Bold",7)
    c.drawRightString(W-1.5*cm,0.35*cm,"juiceupcharging.com")

c = canvas.Canvas("/home/user/charging-simulator/INVESTOR_ONE_PAGER.pdf", pagesize=A4)
bg(c); header(c)
y = H - 5.5*cm

# THE PROBLEM
sec(c,"The Problem",y); y-=0.6*cm
y=bul(c,[
    "4M+ public EV charging points globally growing at 35% YoY — projected 40M by 2030 (IEA, 2024)",
    "Every new CSMS, fleet operator & energy retailer must validate their platform before go-live",
    "No software-native solution exists for comprehensive OCPP testing at scale — until now",
    "Hardware test lab: €50,000–€200,000  |  Integration test cycle: 6–12 weeks per release",
    "A single billing defect across 100 stations can generate hundreds of incorrect invoices per day",
],y); y-=0.25*cm

# MARKET OPPORTUNITY
sec(c,"Market Opportunity",y); y-=0.55*cm
y=tbl(c,
    ["Segment","2024","2030 (Projected)","CAGR"],
    [
        ["TAM — EV Charging Mgmt Software","$2.9B","**$11.4B**","25.5%  (MarketsandMarkets, 2024)"],
        ["SAM — DevTools & Test Infra for CSMS","~$90M","**~$400M**","~28%"],
        ["SOM — 200 paying accounts, 36 months","—","**~$4.6M ARR**","—"],
    ],
    y,[3.5*cm,2.2*cm,2.8*cm,8.4*cm]); y-=0.25*cm

# BUSINESS MODEL
sec(c,"Business Model",y); y-=0.55*cm
y=tbl(c,
    ["Tier","Price","Includes"],
    [
        ["Developer",  "Free",          "Open-source core, community support"],
        ["Pro",        "$299 / month",  "Unlimited fleet simulation, CI/CD webhooks, priority support, advanced scenarios"],
        ["Enterprise", "$2,499 / month","Custom scenario scripting, SLA, white-label, dedicated CSM — Target ACV $18K–$30K"],
    ],
    y,[2.5*cm,2.8*cm,11.6*cm]); y-=0.28*cm
c.setFont("Helvetica-Bold",8); c.setFillColor(ACCENT_GRN)
c.drawString(2.2*cm,y,"Projected ARR at 200 accounts (60% Pro, 40% Enterprise): ~$4.6M")
y-=0.55*cm

# COMPETITIVE DIFFERENTIATION
sec(c,"Competitive Differentiation — No Direct Competitor Matches This Combination",y); y-=0.55*cm
y=tbl(c,
    ["Capability","Manual / Wireshark","Partial OSS Mocks","EV Charger Simulator"],
    [
        ["Full OCPP 1.6J (19 msg types)","Partial","Partial","**All 19 message types**"],
        ["Fleet simulation (100+ chargers)","No","No","**Yes — 500+ on a laptop**"],
        ["Accelerated time (60× compression)","No","No","**Yes**"],
        ["CI/CD integration","No","Manual","**Native**"],
        ["Setup time","Days","Hours","**Under 5 minutes**"],
    ],
    y,[5.0*cm,3.8*cm,3.8*cm,4.3*cm]); y-=0.25*cm

# TRACTION & TECHNOLOGY
sec(c,"Traction & Technology",y); y-=0.55*cm
y=bul(c,[
    "Production-ready OCPP 1.6J — all 19 message types, fully protocol-compliant",
    "Direct integration with ev-server (Apache license; Fortune 500 energy operator deployments; 2,000+ GitHub stars)",
    "Fleet mode validated at 500 simultaneous simulated chargers on a single VM",
    "CI/CD native: GitHub Actions, GitLab CI, Jenkins — drop into any existing pipeline in minutes",
],y); y-=0.25*cm

# USE OF FUNDS
sec(c,"Use of Seed Funding — $750,000",y); y-=0.55*cm
y=tbl(c,
    ["Allocation","%","Use"],
    [
        ["Engineering","40%","OCPP 2.0.1 support, web-based scenario builder UI, managed SaaS platform"],
        ["Sales & Marketing","30%","EV SaaS vendor outreach, EV.Charging Summit, Charge Expo, content"],
        ["Cloud Infrastructure","20%","Simulator-as-a-Service platform (multi-tenant, API-driven)"],
        ["Operations & Legal","10%","IP protection, compliance, administration"],
    ],
    y,[3.8*cm,1.5*cm,11.6*cm]); y-=0.35*cm

# VISION
c.setFillColor(MID_GREEN); c.roundRect(2.2*cm,y-1.1*cm,W-4.0*cm,1.0*cm,5,fill=1,stroke=0)
c.setFillColor(YELLOW); c.setFont("Helvetica-BoldOblique",9)
c.drawCentredString(W/2, y-0.55*cm,
    '"The best time to find a bug in your billing engine is before your first driver gets an incorrect invoice."')

footer(c)
c.save()
print("INVESTOR_ONE_PAGER.pdf generated")
