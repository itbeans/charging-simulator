import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  OCPPMessageType,
  OCPPCall,
  OCPPCallResult,
  OCPPCallError,
  SimulatorConfig,
  ConnectorState,
  BootNotificationRequest,
  BootNotificationResponse,
  HeartbeatResponse,
  StatusNotificationRequest,
  AuthorizeRequest,
  AuthorizeResponse,
  StartTransactionRequest,
  StartTransactionResponse,
  MeterValuesRequest,
  MeterValue,
  SampledValue,
  StopTransactionRequest,
  StopTransactionResponse,
  RemoteStartTransactionRequest,
  RemoteStopTransactionRequest,
  ChangeConfigurationRequest,
  GetConfigurationRequest,
  ResetRequest,
  ChargePointStatus,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(prefix: string, msg: string, data?: unknown): void {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${ts}] ${prefix} ${msg}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${ts}] ${prefix} ${msg}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// ChargerSimulator
// ---------------------------------------------------------------------------

export class ChargerSimulator {
  private config: SimulatorConfig;
  private ws: WebSocket | null = null;

  // Pending outgoing requests: messageId → { resolve, reject, timer }
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void; timer: ReturnType<typeof setTimeout> }>();

  // Internal connector states
  private connectors: Map<number, ConnectorState> = new Map();

  // Timers
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private meterValueTimers: Map<number, ReturnType<typeof setInterval>> = new Map();

  // Reconnect state (boot mode): when enabled, a dropped connection is retried
  // with exponential backoff instead of leaving the charger silently offline.
  private autoReconnect = false;
  private intentionalClose = false;
  private reconnectInitialDelayMs = 5_000;
  private reconnectDelayMs = 5_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Time acceleration factor: 1 = real time; 60 = each real second represents
  // one simulated minute. Scales the meter value timer so accelerated sessions
  // report energy proportional to their simulated duration.
  private timeAcceleration = 1;

  // Local configuration store (responds to GetConfiguration / ChangeConfiguration)
  private configuration: Map<string, string> = new Map([
    ['HeartbeatInterval', '60'],
    ['MeterValueSampleInterval', '60'],
    ['ConnectionTimeOut', '30'],
    ['AuthorizationCacheEnabled', 'false'],
    ['LocalAuthListEnabled', 'false'],
    ['AllowOfflineTxForUnknownId', 'false'],
  ]);

  constructor(config: SimulatorConfig) {
    this.config = config;
    for (const c of config.connectors) {
      this.connectors.set(c.id, {
        id: c.id,
        status: 'Available',
        transactionId: null,
        meterValue: 0,
        sessionStartMeter: 0,
        sessionStartTime: null,
        idTag: null,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  /** Connect to the ev-server and run the boot sequence. */
  async connect(): Promise<void> {
    const url = `${this.config.serverUrl}/${this.config.chargingStationId}`;
    this.info(`Connecting to ${url}`);
    this.intentionalClose = false;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, ['ocpp1.6']);

      this.ws.on('open', async () => {
        this.info('WebSocket connected');
        try {
          await this.boot();
          this.reconnectDelayMs = this.reconnectInitialDelayMs; // successful boot resets the backoff
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.onMessage(data.toString());
      });

      this.ws.on('error', (err) => {
        this.error('WebSocket error', err.message);
        reject(err);
      });

      this.ws.on('close', (code, reason) => {
        this.info(`WebSocket closed (code=${code} reason=${reason.toString()})`);
        this.stopHeartbeat();
        this.stopAllMeterValueTimers();
        // Reject any outstanding promises
        for (const [, p] of this.pending) {
          clearTimeout(p.timer);
          p.reject(new Error(`WebSocket closed (code=${code})`));
        }
        this.pending.clear();
        this.scheduleReconnect();
      });
    });
  }

  /** Gracefully disconnect. */
  async disconnect(): Promise<void> {
    this.intentionalClose = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.stopAllMeterValueTimers();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Simulator shutdown');
    }
    this.ws = null;
  }

  /** True while the WebSocket to the ev-server is open. */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /** Enable automatic reconnection with exponential backoff (used in boot mode). */
  enableAutoReconnect(initialDelayMs = 5_000): void {
    this.autoReconnect = true;
    this.reconnectInitialDelayMs = initialDelayMs;
    this.reconnectDelayMs = initialDelayMs;
  }

  /**
   * Set the time acceleration factor (>= 1). With factor 60, each real second
   * represents one simulated minute: the meter value timer fires 60× faster and
   * each sample still accounts for a full MeterValueSampleInterval of energy,
   * so accelerated sessions report energy consistent with their simulated duration.
   */
  setTimeAcceleration(factor: number): void {
    this.timeAcceleration = Math.max(1, factor);
  }

  private scheduleReconnect(): void {
    if (!this.autoReconnect || this.intentionalClose || this.reconnectTimer !== null) {
      return;
    }
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 60_000);
    this.info(`Reconnecting in ${delay / 1000}s…`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        this.error('Reconnect attempt failed', err instanceof Error ? err.message : err);
        this.scheduleReconnect();
      });
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // Boot sequence
  // ---------------------------------------------------------------------------

  private async boot(): Promise<void> {
    // 1. Send BootNotification
    const bootReq: BootNotificationRequest = {
      chargePointVendor: this.config.vendor,
      chargePointModel: this.config.model,
      chargeBoxSerialNumber: this.config.serialNumber,
      firmwareVersion: this.config.firmwareVersion,
    };
    const bootResp = await this.sendRequest<BootNotificationResponse>('BootNotification', bootReq);
    this.info(`BootNotification → status=${bootResp.status}, interval=${bootResp.interval}s`);

    if (bootResp.status !== 'Accepted') {
      throw new Error(`Server rejected BootNotification: ${bootResp.status}`);
    }

    // Use server-supplied heartbeat interval if present
    const intervalSecs = bootResp.interval || this.config.heartbeatIntervalSecs;
    this.configuration.set('HeartbeatInterval', String(intervalSecs));

    // 2. Send initial StatusNotification for all connectors (connectorId=0 = charger itself)
    await this.sendStatusNotification(0, 'Available');
    for (const [, connector] of this.connectors) {
      await this.sendStatusNotification(connector.id, 'Available');
    }

    // 3. Start heartbeat
    this.startHeartbeat(intervalSecs);
  }

  // ---------------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------------

  private startHeartbeat(intervalSecs: number): void {
    this.stopHeartbeat();
    this.info(`Starting heartbeat every ${intervalSecs}s`);
    this.heartbeatTimer = setInterval(async () => {
      try {
        const resp = await this.sendRequest<HeartbeatResponse>('Heartbeat', {});
        this.debug(`Heartbeat → serverTime=${resp.currentTime}`);
      } catch (err) {
        this.error('Heartbeat failed', err);
      }
    }, intervalSecs * 1000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // StatusNotification
  // ---------------------------------------------------------------------------

  async sendStatusNotification(connectorId: number, status: ChargePointStatus, errorCode = 'NoError' as const): Promise<void> {
    const req: StatusNotificationRequest = {
      connectorId,
      status,
      errorCode,
      timestamp: new Date().toISOString(),
    };
    await this.sendRequest('StatusNotification', req);
    this.info(`StatusNotification connectorId=${connectorId} status=${status}`);

    if (connectorId > 0) {
      const c = this.connectors.get(connectorId);
      if (c) {
        c.status = status;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Authorize
  // ---------------------------------------------------------------------------

  async authorize(idTag: string): Promise<AuthorizeResponse> {
    const req: AuthorizeRequest = { idTag };
    const resp = await this.sendRequest<AuthorizeResponse>('Authorize', req);
    this.info(`Authorize idTag=${idTag} → status=${resp.idTagInfo.status}`);
    return resp;
  }

  // ---------------------------------------------------------------------------
  // StartTransaction
  // ---------------------------------------------------------------------------

  async startTransaction(connectorId: number, idTag: string): Promise<StartTransactionResponse> {
    const connector = this.getConnector(connectorId);

    if (connector.status !== 'Available' && connector.status !== 'Preparing') {
      throw new Error(`Connector ${connectorId} is not available (status=${connector.status})`);
    }

    // Transition to Preparing
    await this.sendStatusNotification(connectorId, 'Preparing');

    const req: StartTransactionRequest = {
      connectorId,
      idTag,
      meterStart: connector.meterValue,
      timestamp: new Date().toISOString(),
    };

    const resp = await this.sendRequest<StartTransactionResponse>('StartTransaction', req);
    this.info(`StartTransaction connectorId=${connectorId} idTag=${idTag} → transactionId=${resp.transactionId} status=${resp.idTagInfo.status}`);

    if (resp.idTagInfo.status === 'Accepted') {
      connector.transactionId = resp.transactionId;
      connector.sessionStartMeter = connector.meterValue;
      connector.sessionStartTime = new Date();
      connector.idTag = idTag;

      await this.sendStatusNotification(connectorId, 'Charging');
      this.startMeterValueTimer(connectorId);
    } else {
      // Authorization failed — go back to Available
      await this.sendStatusNotification(connectorId, 'Available');
    }

    return resp;
  }

  // ---------------------------------------------------------------------------
  // MeterValues
  // ---------------------------------------------------------------------------

  private startMeterValueTimer(connectorId: number): void {
    this.stopMeterValueTimer(connectorId);
    const intervalSecs = parseInt(this.configuration.get('MeterValueSampleInterval') ?? '60', 10);
    // In accelerated mode the timer fires proportionally faster; each sample
    // still accounts for intervalSecs of simulated time (see sendMeterValues),
    // keeping reported energy consistent with the simulated session duration.
    const realIntervalMs = (intervalSecs * 1000) / this.timeAcceleration;
    this.info(`Starting meter value reporting every ${intervalSecs}s${this.timeAcceleration > 1 ? ` (accelerated ×${this.timeAcceleration})` : ''} for connector ${connectorId}`);

    const timer = setInterval(async () => {
      const connector = this.connectors.get(connectorId);
      if (!connector || connector.transactionId === null) {
        this.stopMeterValueTimer(connectorId);
        return;
      }
      try {
        await this.sendMeterValues(connectorId, connector.transactionId);
      } catch (err) {
        this.error(`MeterValues failed for connector ${connectorId}`, err);
      }
    }, realIntervalMs);

    this.meterValueTimers.set(connectorId, timer);
  }

  private stopMeterValueTimer(connectorId: number): void {
    const timer = this.meterValueTimers.get(connectorId);
    if (timer !== undefined) {
      clearInterval(timer);
      this.meterValueTimers.delete(connectorId);
    }
  }

  private stopAllMeterValueTimers(): void {
    for (const [connectorId] of this.meterValueTimers) {
      this.stopMeterValueTimer(connectorId);
    }
  }

  async sendMeterValues(connectorId: number, transactionId: number, context: 'Sample.Periodic' | 'Transaction.End' = 'Sample.Periodic'): Promise<void> {
    const connector = this.getConnector(connectorId);
    const connectorConfig = this.config.connectors.find((c) => c.id === connectorId);
    if (!connectorConfig) {
      return;
    }

    // Simulate power draw (random between 50–100% of max power)
    const powerW = connectorConfig.maxPowerWatts * (0.5 + Math.random() * 0.5);
    const intervalSecs = parseInt(this.configuration.get('MeterValueSampleInterval') ?? '60', 10);
    const energyWh = (powerW * intervalSecs) / 3600;

    connector.meterValue = Math.round(connector.meterValue + energyWh);

    const currentA = powerW / connectorConfig.voltage / connectorConfig.phases;
    const timestamp = new Date().toISOString();

    const sampledValues: SampledValue[] = [
      {
        value: String(connector.meterValue),
        measurand: 'Energy.Active.Import.Register',
        context,
        unit: 'Wh',
      },
      {
        value: String(Math.round(powerW)),
        measurand: 'Power.Active.Import',
        context,
        unit: 'W',
      },
      {
        value: String(connectorConfig.voltage),
        measurand: 'Voltage',
        context,
        unit: 'V',
      },
      {
        value: String(Math.round(currentA * 10) / 10),
        measurand: 'Current.Import',
        context,
        unit: 'A',
      },
    ];

    const meterValue: MeterValue = { timestamp, sampledValue: sampledValues };
    const req: MeterValuesRequest = {
      connectorId,
      transactionId,
      meterValue: [meterValue],
    };

    await this.sendRequest('MeterValues', req);
    this.info(`MeterValues connectorId=${connectorId} txId=${transactionId} energy=${connector.meterValue}Wh power=${Math.round(powerW)}W`);
  }

  // ---------------------------------------------------------------------------
  // StopTransaction
  // ---------------------------------------------------------------------------

  async stopTransaction(connectorId: number, reason: StopTransactionRequest['reason'] = 'Local'): Promise<StopTransactionResponse> {
    const connector = this.getConnector(connectorId);

    if (connector.transactionId === null) {
      throw new Error(`Connector ${connectorId} has no active transaction`);
    }

    // Send final meter value
    await this.sendMeterValues(connectorId, connector.transactionId, 'Transaction.End');
    this.stopMeterValueTimer(connectorId);

    const req: StopTransactionRequest = {
      transactionId: connector.transactionId,
      meterStop: connector.meterValue,
      timestamp: new Date().toISOString(),
      idTag: connector.idTag ?? undefined,
      reason,
    };

    const resp = await this.sendRequest<StopTransactionResponse>('StopTransaction', req);
    this.info(`StopTransaction connectorId=${connectorId} txId=${connector.transactionId} meterStop=${connector.meterValue}Wh reason=${reason}`);

    connector.transactionId = null;
    connector.sessionStartTime = null;
    connector.idTag = null;

    await this.sendStatusNotification(connectorId, 'Finishing');
    await sleep(500);
    await this.sendStatusNotification(connectorId, 'Available');

    return resp;
  }

  // ---------------------------------------------------------------------------
  // Incoming server commands
  // ---------------------------------------------------------------------------

  private async handleServerCommand(messageId: string, command: string, payload: Record<string, unknown>): Promise<void> {
    this.info(`← Server command: ${command}`, this.config.verbose ? payload : undefined);

    let result: Record<string, unknown> = {};

    try {
      switch (command) {
        case 'RemoteStartTransaction': {
          const req = payload as unknown as RemoteStartTransactionRequest;
          const connectorId = req.connectorId ?? 1;
          if (!this.connectors.has(connectorId)) {
            result = { status: 'Rejected' };
            break;
          }
          // Respond first, then execute asynchronously
          result = { status: 'Accepted' };
          this.sendResponse(messageId, result);
          // Run in background — don't await here
          void this.startTransaction(connectorId, req.idTag).catch((err) => {
            this.error('RemoteStartTransaction failed', err);
          });
          return; // already responded
        }

        case 'RemoteStopTransaction': {
          const req = payload as unknown as RemoteStopTransactionRequest;
          // Find connector with this transaction
          const connector = this.findConnectorByTransaction(req.transactionId);
          if (!connector) {
            result = { status: 'Rejected' };
          } else {
            result = { status: 'Accepted' };
            this.sendResponse(messageId, result);
            void this.stopTransaction(connector.id, 'Remote').catch((err) => {
              this.error('RemoteStopTransaction failed', err);
            });
            return;
          }
          break;
        }

        case 'ChangeConfiguration': {
          const req = payload as unknown as ChangeConfigurationRequest;
          this.configuration.set(req.key, req.value);
          this.info(`Configuration changed: ${req.key}=${req.value}`);
          result = { status: 'Accepted' };
          break;
        }

        case 'GetConfiguration': {
          const req = payload as unknown as GetConfigurationRequest;
          const keys = req.key ?? [...this.configuration.keys()];
          const configurationKey = keys.map((k) => ({
            key: k,
            readonly: false,
            value: this.configuration.get(k) ?? '',
          }));
          result = { configurationKey, unknownKey: [] };
          break;
        }

        case 'Reset': {
          const req = payload as unknown as ResetRequest;
          this.info(`Reset requested: ${req.type} — acknowledging, simulating reboot`);
          result = { status: 'Accepted' };
          this.sendResponse(messageId, result);
          // A real charger loses in-flight transactions on reset: stop them with
          // the matching OCPP reason, halt all timers, then re-run boot.
          const stopReason = req.type === 'Hard' ? 'HardReset' : 'SoftReset';
          void (async () => {
            for (const [, c] of this.connectors) {
              if (c.transactionId !== null) {
                try {
                  await this.stopTransaction(c.id, stopReason);
                } catch (err) {
                  this.error(`Failed to stop transaction on connector ${c.id} during reset`, err);
                }
              }
            }
            this.stopHeartbeat();
            this.stopAllMeterValueTimers();
            await sleep(2000);
            try {
              await this.boot();
            } catch (err) {
              this.error('Re-boot after reset failed', err);
            }
          })();
          return;
        }

        case 'UnlockConnector': {
          const req = payload as { connectorId: number };
          const connector = this.connectors.get(req.connectorId);
          if (!connector) {
            result = { status: 'NotSupported' };
          } else {
            result = { status: 'Unlocked' };
          }
          break;
        }

        case 'ClearCache': {
          this.info('ClearCache requested — acknowledging');
          result = { status: 'Accepted' };
          break;
        }

        case 'SetChargingProfile': {
          this.info('SetChargingProfile — accepting (not enforced in simulator)');
          result = { status: 'Accepted' };
          break;
        }

        case 'ClearChargingProfile': {
          this.info('ClearChargingProfile — accepting');
          result = { status: 'Accepted' };
          break;
        }

        case 'GetDiagnostics': {
          this.info('GetDiagnostics requested');
          result = { fileName: 'diagnostics.log' };
          break;
        }

        case 'UpdateFirmware': {
          this.info('UpdateFirmware requested — simulating');
          result = {};
          break;
        }

        case 'DataTransfer': {
          result = { status: 'Accepted' };
          break;
        }

        default:
          this.info(`Unknown server command: ${command}`);
          this.sendError(messageId, 'NotImplemented', `Command not implemented: ${command}`);
          return;
      }
    } catch (err) {
      this.error(`Error handling ${command}`, err);
      this.sendError(messageId, 'InternalError', String(err));
      return;
    }

    this.sendResponse(messageId, result);
  }

  // ---------------------------------------------------------------------------
  // WebSocket message handling
  // ---------------------------------------------------------------------------

  private onMessage(raw: string): void {
    if (this.config.verbose) {
      this.debug('← RAW', raw);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.error('Failed to parse message', raw);
      return;
    }

    if (!Array.isArray(parsed) || parsed.length < 3) {
      this.error('Unexpected message format', parsed);
      return;
    }

    const [messageType, messageId] = parsed as [number, string];

    if (messageType === OCPPMessageType.CALL_RESULT) {
      // Response to one of our requests
      const payload = parsed[2] as Record<string, unknown>;
      const pending = this.takePending(messageId);
      if (pending) {
        pending.resolve(payload);
      } else {
        this.error(`Received CALL_RESULT for unknown messageId: ${messageId}`);
      }
    } else if (messageType === OCPPMessageType.CALL_ERROR) {
      const [, , errorCode, errorDescription] = parsed as OCPPCallError;
      const pending = this.takePending(messageId);
      if (pending) {
        pending.reject(new Error(`OCPP Error ${errorCode}: ${errorDescription}`));
      }
    } else if (messageType === OCPPMessageType.CALL) {
      const [, , command, payload] = parsed as OCPPCall;
      void this.handleServerCommand(messageId, command, payload);
    } else {
      this.error('Unknown message type', messageType);
    }
  }

  // ---------------------------------------------------------------------------
  // Send helpers
  // ---------------------------------------------------------------------------

  private sendRequest<T>(command: string, payload: object): Promise<T> {
    return new Promise((resolve, reject) => {
      const messageId = uuidv4();
      const message: OCPPCall = [OCPPMessageType.CALL, messageId, command, payload as Record<string, unknown>];
      const raw = JSON.stringify(message);

      if (this.config.verbose) {
        this.debug(`→ ${command}`, payload);
      }

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not open'));
        return;
      }

      // Request timeout (default 30 seconds)
      const timeoutMs = (this.config.requestTimeoutSecs ?? 30) * 1000;
      const timer = setTimeout(() => {
        if (this.pending.delete(messageId)) {
          reject(new Error(`Request timeout for ${command} (messageId=${messageId})`));
        }
      }, timeoutMs);

      this.pending.set(messageId, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this.ws.send(raw, (err) => {
        if (err) {
          this.takePending(messageId);
          reject(err);
        }
      });
    });
  }

  /** Remove a pending request and clear its timeout timer. */
  private takePending(messageId: string): { resolve: (v: unknown) => void; reject: (e: unknown) => void } | undefined {
    const p = this.pending.get(messageId);
    if (p) {
      this.pending.delete(messageId);
      clearTimeout(p.timer);
    }
    return p;
  }

  private sendResponse(messageId: string, payload: Record<string, unknown>): void {
    const message: OCPPCallResult = [OCPPMessageType.CALL_RESULT, messageId, payload];
    const raw = JSON.stringify(message);
    if (this.config.verbose) {
      this.debug(`→ CALL_RESULT`, payload);
    }
    this.ws?.send(raw);
  }

  private sendError(messageId: string, errorCode: string, description: string): void {
    const message: OCPPCallError = [OCPPMessageType.CALL_ERROR, messageId, errorCode, description, {}];
    this.ws?.send(JSON.stringify(message));
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private getConnector(connectorId: number): ConnectorState {
    const c = this.connectors.get(connectorId);
    if (!c) {
      throw new Error(`Unknown connector: ${connectorId}`);
    }
    return c;
  }

  private findConnectorByTransaction(transactionId: number): ConnectorState | undefined {
    for (const [, c] of this.connectors) {
      if (c.transactionId === transactionId) {
        return c;
      }
    }
    return undefined;
  }

  getConnectorStatus(connectorId: number): ConnectorState {
    return this.getConnector(connectorId);
  }

  getAllConnectorStatuses(): ConnectorState[] {
    return [...this.connectors.values()];
  }

  private info(msg: string, data?: unknown): void {
    log(`[${this.config.chargingStationId}]`, msg, data);
  }

  private debug(msg: string, data?: unknown): void {
    log(`[${this.config.chargingStationId}][DBG]`, msg, data);
  }

  private error(msg: string, data?: unknown): void {
    log(`[${this.config.chargingStationId}][ERR]`, msg, data);
  }
}
