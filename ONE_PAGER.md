# EV Charger Simulator
### Test your EV charging network at any scale — before it goes live.

---

## The Problem

**A single billing defect across 100 charging stations generates ~500 incorrect invoices per day.**

Testing EV charging software with physical hardware is expensive, slow, and can't scale:

- A hardware test lab costs **€50,000–€200,000** (€500–€5,000 per charger)
- Real-world integration tests take **6–12 weeks** to set up with physical equipment
- Edge cases — concurrent sessions, network drops, firmware resets, billing failures — are nearly **impossible to script repeatably** with hardware
- Industry data: **23% of new EV charging deployments** report billing or connectivity defects within 30 days of go-live

---

## The Solution

**EV Charger Simulator** — a fully software-native OCPP 1.6J charger that connects to your charging management system exactly as real hardware would. No racks. No cables. No field engineers.

- Full **OCPP 1.6J compliance** — the standard governing 85%+ of the world's 4 million+ public charging points
- Simulates **all 19 OCPP message types** (BootNotification → StopTransaction and every server command in between)
- Real energy metering: **energy (Wh), power (W), voltage (V), current (A)** — exactly what billing pipelines expect
- **Zero hardware. Zero cost. 5-minute setup.**

---

## Four Modes. Every Test Scenario Covered.

| Mode | What It Does | When to Use |
|---|---|---|
| `boot` | Connects, boots, stays live — responds to every dashboard command in real time | Manual QA, remote command testing |
| `session` | Full Authorize → Start → MeterValues → Stop in seconds | End-to-end billing validation |
| `multi` | All connectors charging simultaneously | Smart charging, load balancing, per-connector billing |
| `fleet` | 10, 50, 100+ independent chargers in parallel | Load testing, stress testing, CI/CD regression suites |

---

## Accelerated Time — Compress Hours into Seconds

Set `EV_SIM_ACCELERATED=true` and **1 simulated minute = 1 real second**.

- Validate a **60-minute charging session in 60 seconds**
- Run inactivity alerts, session timeouts, and billing calculations in a coffee break
- Execute a **full 500-charger overnight regression suite** that would take weeks with hardware

---

## Real Numbers

| | Physical Hardware | EV Charger Simulator |
|---|---|---|
| Unit cost | €500 – €5,000 | **€0** |
| Test lab setup | Days to weeks | **Under 5 minutes** |
| Concurrent chargers | Limited by budget | **500+ on a single laptop** |
| Session duration | Real time (60 min = 60 min) | **Compressed (60 min = 60 sec)** |
| Edge case reproduction | Manual, unreliable | **Fully scripted, 100% repeatable** |
| CI/CD integration | Not possible | **Native — GitHub Actions, GitLab, Jenkins** |

---

## Everything a Real Charger Does

**Charger → Server (7 message types)**
`BootNotification` · `Heartbeat` · `StatusNotification` · `Authorize` · `StartTransaction` · `MeterValues` · `StopTransaction`

**Server → Charger (12 commands — all handled automatically)**
`RemoteStart/Stop` · `ChangeConfiguration` · `GetConfiguration` · `Reset (Hard/Soft)` · `UnlockConnector` · `ClearCache` · `SetChargingProfile` · `ClearChargingProfile` · `GetDiagnostics` · `UpdateFirmware`

---

## Get Running in Under 5 Minutes

```bash
npm install
cp config.example.json config.json   # add your tenant ID + registration token
npm run dev boot                      # your virtual charger is live
```

Test a full session with accelerated time:
```bash
EV_SIM_ID_TAG=AABBCCDD EV_SIM_ACCELERATED=true npm run dev session
```

Stress-test with a 50-charger fleet:
```bash
EV_SIM_FLEET_COUNT=50 EV_SIM_ACCELERATED=true npm run dev fleet
```

---

## Built On

**OCPP 1.6J** · **TypeScript / Node.js** · **WebSocket/JSON** · Works with any ev-server deployment · Docker & CI/CD ready

---

*The fastest way to ship EV charging software with confidence.*
