# EV Charger Simulator
<<<<<<< HEAD
## Validate OCPP charging operations without physical hardware
=======
### Test your EV charging network at any scale — before it goes live.
>>>>>>> 7ed6ff06cd333cd2d6f5f90acad692efa051eb17

### What it is
The EV Charger Simulator is a production-focused **OCPP 1.6J simulation toolkit** that behaves like real charging stations over WebSocket. Teams use it to test onboarding, charging sessions, billing logic, and remote command handling before deploying to live infrastructure.

<<<<<<< HEAD
### Why teams use it
- **Launch faster:** test charger workflows on day one, without waiting for devices in the field.
- **Lower QA cost:** run repeatable automated scenarios instead of manual hardware test cycles.
- **Catch edge cases early:** validate resets, reconnects, meter bursts, and fleet surges in controlled environments.
- **Scale confidently:** simulate dozens of connectors and multiple stations in parallel.

### Core capabilities
- Full charger lifecycle support:
  - `BootNotification`, `StatusNotification`, `Heartbeat`
  - `Authorize`, `StartTransaction`, `MeterValues`, `StopTransaction`
- Handles server-initiated commands, including:
  - `RemoteStartTransaction`, `RemoteStopTransaction`, `Reset`
  - `ChangeConfiguration`, `GetConfiguration`
  - `SetChargingProfile`, `ClearCache`, `UnlockConnector`
- Meter values for realistic downstream testing:
  - Energy, power, current, and voltage streams
=======
## The Problem

**A single billing defect across 100 charging stations generates ~500 incorrect invoices per day.**

Testing EV charging software with physical hardware is expensive, slow, and can't scale:

- A hardware test lab costs **€50,000–€200,000** (€500–€5,000 per charger)
- Real-world integration tests take **6–12 weeks** to set up with physical equipment
- Edge cases — concurrent sessions, network drops, firmware resets, billing failures — are nearly **impossible to script repeatably** with hardware
- Industry data: **23% of new EV charging deployments** report billing or connectivity defects within 30 days of go-live
>>>>>>> 7ed6ff06cd333cd2d6f5f90acad692efa051eb17

### Four usage modes
1. **boot** — keeps a simulated charger online for manual command testing.
2. **session** — executes one complete charge session flow.
3. **multi** — runs concurrent sessions across all connectors.
4. **fleet** — launches many chargers simultaneously for load and stress tests.

<<<<<<< HEAD
### Built for engineering and operations
- Supports local development, CI pipelines, and staging validation.
- Accelerated time mode can compress long sessions into short test windows.
- Helps verify platform behavior before touching customer-facing systems.

### Typical outcomes
- Faster integration with OCPP-compliant backends
- Better reliability of remote operations
- More predictable releases with fewer field regressions
- Improved confidence in billing and transaction analytics

### Quick start
```bash
npm install
cp config.example.json config.json
npm run dev boot
```

### Best fit
The simulator is ideal for EV charging platforms, CPO engineering teams, integrators, and QA organizations that need dependable, repeatable charger behavior at scale.
=======
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
>>>>>>> 7ed6ff06cd333cd2d6f5f90acad692efa051eb17
