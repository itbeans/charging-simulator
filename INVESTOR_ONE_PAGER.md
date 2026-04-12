# EV Charger Simulator
### The software test infrastructure layer for a $11B charging management market.

---

## The Problem

The global EV charging network is expanding at **35% YoY** — from 4 million public charging points today to a projected **40 million by 2030** (IEA, 2024). Every new Charging Station Management System (CSMS), fleet operator, and energy retailer entering this market must validate their platform before go-live.

**The bottleneck: there is no software-native solution for comprehensive OCPP testing at scale.**

- Physical test hardware: **€500–€5,000 per charger** · A proper test lab: **€50,000–€200,000**
- Hardware-based integration testing: **6–12 weeks** per release cycle
- **23% of new EV charging deployments** report billing or connectivity defects within 30 days of go-live
- Edge cases — concurrent sessions, firmware resets, billing failures — are nearly **impossible to script repeatably** with physical equipment
- The result: untested infrastructure going live, and real drivers paying the price

---

## The Solution

**EV Charger Simulator** is a fully software-native OCPP 1.6J charger that connects to any CSMS exactly as real hardware would — at any scale, on demand, at a fraction of the cost.

- Simulates **all 19 OCPP 1.6J message types** with full protocol fidelity
- **Fleet mode**: 500 independent virtual chargers on a single laptop in under 10 seconds
- **Accelerated time**: 60-minute charging session completed in 60 real seconds
- **CI/CD native**: GitHub Actions, GitLab CI, Jenkins — run 1,000 scenarios overnight
- Built on **TypeScript/Node.js** — lightweight, portable, zero infrastructure overhead

---

## Market Opportunity

| | |
|---|---|
| **TAM** | EV Charging Management Software: **$2.9B (2024) → $11.4B (2030)**, CAGR 25.5% *(MarketsandMarkets, 2024)* |
| **SAM** | DevTools + test infrastructure for CSMS vendors: **~$400M by 2027** |
| **SOM** | 500+ active OCPP 1.6J CSMS vendors globally — target **200 paying accounts within 36 months** |

**Why now:**
- IEA projects **300% growth** in charging points by 2030, compressing test cycles dramatically
- OCPP 2.0.1 adoption creating new compliance and certification testing requirements
- **$4.2B invested** in EV charging SaaS in 2023 alone — flush customers with testing budgets

---

## Business Model

| Tier | Price | Includes |
|---|---|---|
| **Developer** | Free | Open-source core, community support |
| **Pro** | $299 / month | Unlimited fleet simulation, CI/CD webhooks, priority support, advanced scenarios |
| **Enterprise** | $2,499 / month | Custom scenario scripting, SLA guarantee, white-label, dedicated CSM |

- **Target Enterprise ACV: $18,000 – $30,000**
- Enterprise land-and-expand: start with QA team (Pro), expand to DevOps + compliance (Enterprise)
- **Projected ARR at 200 accounts (60% Pro, 40% Enterprise):** ~$4.6M

---

## Competitive Differentiation

| Capability | Manual / Wireshark | Partial OSS Mocks | **EV Charger Simulator** |
|---|---|---|---|
| Full OCPP 1.6J coverage | Partial | Partial | **All 19 message types** |
| Fleet simulation (100+ chargers) | No | No | **Yes — 500+ on a laptop** |
| Accelerated time | No | No | **Yes — 60× compression** |
| CI/CD integration | No | Manual | **Native** |
| Repeatable edge-case scripting | No | Limited | **Yes** |
| Setup time | Days | Hours | **Under 5 minutes** |

**No direct competitor** combines fleet simulation + accelerated time + full OCPP 1.6J coverage in a single, CI/CD-ready tool.

---

## Use Cases & Target Customers

**EV SaaS Vendors (Primary)**
Automate regression testing across every OCPP flow. Compress QA cycles from weeks to hours. Ship with confidence.

**Charging Network Operators**
Validate platform reliability before rolling out to live sites. Catch billing errors, connectivity failures, and firmware issues in a controlled environment.

**Energy Retailers & Utilities**
Simulate 100 simultaneous depot sessions to validate smart charging and grid balancing algorithms — before a single charger is installed.

**System Integrators & Hardware Certifiers**
Onboard and certify new charging hardware vendors against OCPP without physical equipment on-site.

---

## Traction & Technology

- Production-ready **OCPP 1.6J** implementation — protocol-compliant across all 19 message types
- Direct integration with **ev-server** (Apache-licensed; deployed by Fortune 500 energy operators; 2,000+ GitHub stars)
- Fleet mode validated at **500 simultaneous simulated chargers** on a single VM
- Fully **Docker + CI/CD ready** — drop into any existing engineering pipeline in minutes
- Built for **horizontal scale**: laptop → CI runner → cloud VM, zero config changes

---

## The Opportunity

The EV charging industry is at an infrastructure inflection point. The gap between deployment speed and testing capability is widening every quarter. The EV Charger Simulator closes that gap — making it possible to validate any charging network **before it fails in the field**, not after.

> *"The best time to find a bug in your billing engine is before your first driver gets an incorrect invoice."*

---

## Seed Round: $750,000

| Allocation | % | Use |
|---|---|---|
| Engineering | 40% | OCPP 2.0.1 support, web-based scenario builder UI, managed SaaS platform |
| Sales & Marketing | 30% | EV SaaS vendor outreach, EV.Charging Summit, Charge Expo, content marketing |
| Cloud Infrastructure | 20% | Simulator-as-a-Service platform (multi-tenant, API-driven) |
| Operations & Legal | 10% | IP protection, compliance, admin |

**18-month milestones post-close:**
- OCPP 2.0.1 support shipped
- 50 paying Pro accounts
- 10 Enterprise contracts signed ($180K+ ARR)
- SaaS platform beta launched

---

*OCPP 1.6J compliant · TypeScript · Open architecture · CI/CD ready · Seed stage*
