# EV Charger Simulator

A standalone OCPP 1.6J charger simulator for testing the **ev-server** Central System.

It speaks the same WebSocket/JSON protocol that real chargers use and handles all major OCPP flows:

| Direction | Messages |
|---|---|
| Charger → Server | BootNotification, Heartbeat, StatusNotification, Authorize, StartTransaction, MeterValues, StopTransaction |
| Server → Charger | RemoteStartTransaction, RemoteStopTransaction, ChangeConfiguration, GetConfiguration, Reset, UnlockConnector, ClearCache, SetChargingProfile, ClearChargingProfile, GetDiagnostics, UpdateFirmware |

---

## Prerequisites

- Node.js 16+
- A running ev-server instance
- A valid **Tenant ID** and **Registration Token** from the ev-server (see below)

---

## Setup

```bash
npm install
cp config.example.json config.json
```

Edit `config.json`:

```json
{
  "serverUrl": "ws://localhost:8010/OCPP16/<TENANT_ID>/<REGISTRATION_TOKEN_ID>",
  "chargingStationId": "SIM-CS-001",
  ...
}
```

### Getting your Tenant ID and Registration Token

1. Log into the ev-server dashboard as an Admin.
2. Go to **Settings → Charging Stations → Registration Tokens** and create a new token.
3. Copy the **Tenant ID** (from the URL or tenant settings) and the **Registration Token ID**.
4. Paste both into `serverUrl` in `config.json`.

---

## Usage

### `boot` — Connect and stay online

Connects the simulated charger, completes the boot sequence, then keeps it running so you can send remote commands from the dashboard.

```bash
npm run dev boot
# or after build:
npm start boot
```

The charger will:
- Send `BootNotification`
- Send `StatusNotification` for each connector (Available)
- Start the heartbeat loop
- Listen for and respond to any server-initiated commands

Press **Ctrl+C** to disconnect cleanly.

---

### `session` — Run a single charging session

Connects, boots, runs one complete charging session, then exits.

```bash
EV_SIM_ID_TAG=AABBCCDD \
EV_SIM_DURATION_MINS=5 \
EV_SIM_ACCELERATED=true \
npm run dev session
```

| Variable | Default | Description |
|---|---|---|
| `EV_SIM_ID_TAG` | `AABBCCDD` | RFID tag used to start the session |
| `EV_SIM_DURATION_MINS` | `5` | Session length in simulated minutes |
| `EV_SIM_ACCELERATED` | `false` | `true` = 1 simulated minute takes 1 real second |

---

### `multi` — Simultaneous sessions on all connectors

Starts a session on every connector at the same time — useful for testing smart charging / load balancing.

```bash
EV_SIM_ID_TAGS=AABBCCDD,11223344 \
EV_SIM_DURATION_MINS=5 \
EV_SIM_ACCELERATED=true \
npm run dev multi
```

| Variable | Default | Description |
|---|---|---|
| `EV_SIM_ID_TAGS` | `AABBCCDD,11223344` | Comma-separated tags, one per connector |
| `EV_SIM_DURATION_MINS` | `5` | Session length |
| `EV_SIM_ACCELERATED` | `false` | Accelerated time |

---

### `fleet` — Multiple simultaneous chargers

Spawns N independent charger instances, each with its own WebSocket connection and session.  Useful for load / stress testing.

```bash
EV_SIM_FLEET_COUNT=10 \
EV_SIM_ID_TAG=AABBCCDD \
EV_SIM_DURATION_MINS=5 \
EV_SIM_ACCELERATED=true \
npm run dev fleet
```

| Variable | Default | Description |
|---|---|---|
| `EV_SIM_FLEET_COUNT` | `3` | Number of chargers to simulate |
| `EV_SIM_ID_TAG` | `AABBCCDD` | RFID tag used by all chargers |
| `EV_SIM_DURATION_MINS` | `5` | Session length |
| `EV_SIM_ACCELERATED` | `false` | Accelerated time |

Charger IDs are generated as `<chargingStationId>-01`, `-02`, etc.

---

## Environment variable reference

| Variable | Description |
|---|---|
| `EV_SIM_CONFIG` | Path to config file (default: `config.json` in the repo root) |
| `EV_SIM_SERVER_URL` | Override `serverUrl` from config |
| `EV_SIM_STATION_ID` | Override `chargingStationId` from config |
| `EV_SIM_VERBOSE` | Set `true` to log all raw OCPP messages |
| `EV_SIM_ID_TAG` | RFID tag for session commands |
| `EV_SIM_ID_TAGS` | Comma-separated tags for multi-connector commands |
| `EV_SIM_DURATION_MINS` | Session duration in simulated minutes |
| `EV_SIM_ACCELERATED` | `true` = 1 simulated minute = 1 real second |
| `EV_SIM_FLEET_COUNT` | Number of chargers for the `fleet` command |

---

## What the simulator does during a session

```
[boot]
  → BootNotification        (vendor, model, serial, firmware)
  ← Accepted + heartbeat interval
  → StatusNotification x N  (connectorId=0 + each connector: Available)
  → Heartbeat               (every N seconds, forever)

[session start]
  → Authorize               (idTag)
  ← Accepted
  → StatusNotification      (connectorId=1, Preparing)
  → StartTransaction        (connectorId, idTag, meterStart, timestamp)
  ← transactionId
  → StatusNotification      (connectorId=1, Charging)

[during session — every meterValueIntervalSecs]
  → MeterValues             (Energy.Active.Import.Register, Power.Active.Import,
                             Voltage, Current.Import)

[session stop]
  → MeterValues             (context=Transaction.End, final reading)
  → StopTransaction         (transactionId, meterStop, reason)
  ← Accepted
  → StatusNotification      (Finishing → Available)
```

---

## Server → Charger commands (handled automatically)

When the simulator is running in `boot` mode you can trigger these from the ev-server dashboard and the simulator will respond correctly:

| Command | Simulator behaviour |
|---|---|
| RemoteStartTransaction | Starts a transaction on the requested connector |
| RemoteStopTransaction | Stops the matching transaction |
| ChangeConfiguration | Updates the local configuration key |
| GetConfiguration | Returns current configuration values |
| Reset (Hard/Soft) | Acknowledges then re-sends BootNotification |
| UnlockConnector | Returns Unlocked |
| ClearCache | Returns Accepted |
| SetChargingProfile | Returns Accepted (not enforced) |
| ClearChargingProfile | Returns Accepted |
| GetDiagnostics | Returns a dummy filename |
| UpdateFirmware | Acknowledges |

---

## Building for production

```bash
npm run build
npm start boot
```

---

## Testing

The test suite runs the simulator against an in-process mock OCPP Central System
(`test/helpers/MockOCPPServer.ts`) — no external server or hardware needed.

```bash
npm test          # run once (CI mode)
npm run test:watch # watch mode during development
```

Coverage spans the full protocol surface:

| Test file | Covers |
|---|---|
| `test/connection.test.ts` | Boot sequence, heartbeats, request timeouts, dropped connections, auto-reconnect |
| `test/session.test.ts` | Authorize → Start → MeterValues → Stop flow, status transitions, meter accounting, accelerated time |
| `test/serverCommands.test.ts` | All server → charger commands incl. RemoteStart/Stop, Reset, configuration round-trips |
| `test/scenarios.test.ts` | End-to-end `session` and `multi` scenarios in accelerated mode |

Tests also run automatically in CI on every push and pull request
(`.github/workflows/test.yml`).

---

## Project structure

```
charging-simulator/
├── config.example.json          # Copy to config.json and fill in your values
├── package.json
├── tsconfig.json
├── Dockerfile                   # Multi-stage production image
├── cloudbuild.yaml              # Cloud Build CI/CD pipeline
├── DEPLOYMENT.md                # GCP deployment guide
├── cloudrun/                    # GCP setup scripts (setup, jobs, monitoring)
├── scripts/                     # Doc/PDF generation tooling
├── test/                        # Vitest suite + mock OCPP server helper
│   ├── helpers/MockOCPPServer.ts
│   ├── connection.test.ts
│   ├── session.test.ts
│   ├── serverCommands.test.ts
│   └── scenarios.test.ts
└── src/
    ├── index.ts                 # CLI entry point (boot | session | multi | fleet)
    ├── types.ts                 # OCPP 1.6 type definitions
    ├── ChargerSimulator.ts      # Core simulator class
    └── scenarios/
        ├── BasicChargingSession.ts    # Single-connector session scenario
        └── MultiConnectorSession.ts   # All-connectors simultaneous scenario
```
