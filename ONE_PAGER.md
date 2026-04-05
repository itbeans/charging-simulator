# EV Charger Simulator
### Test your EV charging infrastructure — without a single physical charger.

---

## What is it?

A fully-featured **OCPP 1.6J charger simulator** that connects to your ev-server exactly like a real charging station would. Boot it, run sessions, stress-test your backend, and validate every remote command — all from a single command line.

---

## Why it matters

| Without the simulator | With the simulator |
|---|---|
| Need physical hardware to test | Test instantly on any machine |
| One charger = one test scenario | Spin up 100 chargers in seconds |
| Slow real-world session timing | Compress hours into seconds |
| Hard to reproduce edge cases | Script any scenario repeatably |
| Risky to test resets/faults in prod | Safely break things in dev |

---

## Four modes. One tool.

### `boot` — Always-on charger
Connects and stays online. Responds to every command from the dashboard in real time. Perfect for manual QA sessions.
```bash
npm run dev boot
```

### `session` — Single charging session
Authorize → Start → Meter values → Stop. A complete end-to-end flow, done in seconds with accelerated time.
```bash
EV_SIM_ID_TAG=AABBCCDD EV_SIM_ACCELERATED=true npm run dev session
```

### `multi` — All connectors, simultaneously
Fills every connector on the charger at once. Validates smart charging, load balancing, and per-connector billing in one run.
```bash
EV_SIM_ID_TAGS=TAG001,TAG002 EV_SIM_ACCELERATED=true npm run dev multi
```

### `fleet` — 10, 50, 100 chargers at once
Launches a full fleet of independent chargers in parallel. The fastest way to load-test your server.
```bash
EV_SIM_FLEET_COUNT=50 EV_SIM_ACCELERATED=true npm run dev fleet
```

---

## Everything a real charger does

**Charger → Server**
`BootNotification` · `Heartbeat` · `StatusNotification` · `Authorize` · `StartTransaction` · `MeterValues` · `StopTransaction`

**Server → Charger** *(all handled automatically)*
`RemoteStart/Stop` · `ChangeConfiguration` · `GetConfiguration` · `Reset` · `UnlockConnector` · `ClearCache` · `SetChargingProfile` · `GetDiagnostics` · `UpdateFirmware`

Meter values include **energy, power, voltage, and current** — exactly what your billing and analytics pipelines expect.

---

## Accelerated time

Run a **60-minute charging session in 60 seconds.** Every simulated minute becomes a real second, so you can validate billing calculations, inactivity alerts, and session timeouts in a coffee break.

---

## Zero hardware. Zero cost. Instant setup.

```bash
cd simulator && npm install
cp config.example.json config.json   # add your tenant ID + registration token
npm run dev boot                      # your charger is live
```

---

*Built on OCPP 1.6J · TypeScript · WebSocket · Works with any ev-server deployment*
