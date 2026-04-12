# EV Charger Simulator
## Validate OCPP charging operations without physical hardware

### What it is
The EV Charger Simulator is a production-focused **OCPP 1.6J simulation toolkit** that behaves like real charging stations over WebSocket. Teams use it to test onboarding, charging sessions, billing logic, and remote command handling before deploying to live infrastructure.

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

### Four usage modes
1. **boot** — keeps a simulated charger online for manual command testing.
2. **session** — executes one complete charge session flow.
3. **multi** — runs concurrent sessions across all connectors.
4. **fleet** — launches many chargers simultaneously for load and stress tests.

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
