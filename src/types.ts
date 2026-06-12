// ---------------------------------------------------------------------------
// OCPP 1.6 Message Types
// ---------------------------------------------------------------------------

export const enum OCPPMessageType {
  CALL = 2,
  CALL_RESULT = 3,
  CALL_ERROR = 4,
}

// [type, messageId, command, payload]
export type OCPPCall = [OCPPMessageType.CALL, string, string, Record<string, unknown>];
// [type, messageId, payload]
export type OCPPCallResult = [OCPPMessageType.CALL_RESULT, string, Record<string, unknown>];
// [type, messageId, errorCode, errorDescription, details]
export type OCPPCallError = [OCPPMessageType.CALL_ERROR, string, string, string, Record<string, unknown>];

export type OCPPMessage = OCPPCall | OCPPCallResult | OCPPCallError;

// ---------------------------------------------------------------------------
// BootNotification
// ---------------------------------------------------------------------------

export interface BootNotificationRequest {
  chargePointVendor: string;
  chargePointModel: string;
  chargeBoxSerialNumber?: string;
  chargePointSerialNumber?: string;
  firmwareVersion?: string;
  iccid?: string;
  imsi?: string;
  meterSerialNumber?: string;
  meterType?: string;
}

export interface BootNotificationResponse {
  status: 'Accepted' | 'Pending' | 'Rejected';
  currentTime: string;
  interval: number; // heartbeat interval in seconds
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

export type HeartbeatRequest = Record<string, never>;

export interface HeartbeatResponse {
  currentTime: string;
}

// ---------------------------------------------------------------------------
// StatusNotification
// ---------------------------------------------------------------------------

export type ChargePointStatus =
  | 'Available'
  | 'Preparing'
  | 'Charging'
  | 'SuspendedEVSE'
  | 'SuspendedEV'
  | 'Finishing'
  | 'Reserved'
  | 'Unavailable'
  | 'Faulted';

export type ChargePointErrorCode =
  | 'ConnectorLockFailure'
  | 'EVCommunicationError'
  | 'GroundFailure'
  | 'HighTemperature'
  | 'InternalError'
  | 'LocalListConflict'
  | 'NoError'
  | 'OtherError'
  | 'OverCurrentFailure'
  | 'PowerMeterFailure'
  | 'PowerSwitchFailure'
  | 'ReaderFailure'
  | 'ResetFailure'
  | 'UnderVoltage'
  | 'WeakSignal';

export interface StatusNotificationRequest {
  connectorId: number;
  errorCode: ChargePointErrorCode;
  status: ChargePointStatus;
  timestamp?: string;
  info?: string;
  vendorId?: string;
  vendorErrorCode?: string;
}

export type StatusNotificationResponse = Record<string, never>;

// ---------------------------------------------------------------------------
// Authorize
// ---------------------------------------------------------------------------

export interface AuthorizeRequest {
  idTag: string;
}

export type OCPPAuthorizationStatus =
  | 'Accepted'
  | 'Blocked'
  | 'Expired'
  | 'Invalid'
  | 'ConcurrentTx';

export interface AuthorizeResponse {
  idTagInfo: {
    status: OCPPAuthorizationStatus;
    expiryDate?: string;
    parentIdTag?: string;
  };
}

// ---------------------------------------------------------------------------
// StartTransaction
// ---------------------------------------------------------------------------

export interface StartTransactionRequest {
  connectorId: number;
  idTag: string;
  meterStart: number; // Wh
  timestamp: string;
  reservationId?: number;
}

export interface StartTransactionResponse {
  transactionId: number;
  idTagInfo: {
    status: OCPPAuthorizationStatus;
    expiryDate?: string;
    parentIdTag?: string;
  };
}

// ---------------------------------------------------------------------------
// MeterValues
// ---------------------------------------------------------------------------

export type OCPPMeasurand =
  | 'Energy.Active.Import.Register'
  | 'Power.Active.Import'
  | 'Current.Import'
  | 'Voltage'
  | 'SoC'
  | 'Temperature';

export type OCPPUnitOfMeasure = 'Wh' | 'kWh' | 'W' | 'kW' | 'A' | 'V' | 'Celsius' | 'Percent';
export type OCPPReadingContext = 'Interruption.Begin' | 'Interruption.End' | 'Sample.Clock' | 'Sample.Periodic' | 'Transaction.Begin' | 'Transaction.End' | 'Trigger' | 'Other';
export type OCPPPhase = 'L1' | 'L2' | 'L3' | 'N' | 'L1-N' | 'L2-N' | 'L3-N' | 'L1-L2' | 'L2-L3' | 'L3-L1';

export interface SampledValue {
  value: string;
  context?: OCPPReadingContext;
  measurand?: OCPPMeasurand;
  phase?: OCPPPhase;
  unit?: OCPPUnitOfMeasure;
  format?: 'Raw' | 'SignedData';
  location?: 'Body' | 'Cable' | 'EV' | 'Inlet' | 'Outlet';
}

export interface MeterValue {
  timestamp: string;
  sampledValue: SampledValue[];
}

export interface MeterValuesRequest {
  connectorId: number;
  transactionId?: number;
  meterValue: MeterValue[];
}

export type MeterValuesResponse = Record<string, never>;

// ---------------------------------------------------------------------------
// StopTransaction
// ---------------------------------------------------------------------------

export type OCPPStopReason =
  | 'EmergencyStop'
  | 'EVDisconnected'
  | 'HardReset'
  | 'Local'
  | 'Other'
  | 'PowerLoss'
  | 'Reboot'
  | 'Remote'
  | 'SoftReset'
  | 'UnlockCommand'
  | 'DeAuthorized';

export interface StopTransactionRequest {
  transactionId: number;
  meterStop: number; // Wh
  timestamp: string;
  idTag?: string;
  reason?: OCPPStopReason;
  transactionData?: MeterValue[];
}

export interface StopTransactionResponse {
  idTagInfo?: {
    status: OCPPAuthorizationStatus;
  };
}

// ---------------------------------------------------------------------------
// Server → Charger commands (incoming requests)
// ---------------------------------------------------------------------------

export interface RemoteStartTransactionRequest {
  connectorId?: number;
  idTag: string;
  chargingProfile?: unknown;
}

export interface RemoteStopTransactionRequest {
  transactionId: number;
}

export interface ChangeConfigurationRequest {
  key: string;
  value: string;
}

export interface GetConfigurationRequest {
  key?: string[];
}

export interface ResetRequest {
  type: 'Hard' | 'Soft';
}

export interface UnlockConnectorRequest {
  connectorId: number;
}

export interface SetChargingProfileRequest {
  connectorId: number;
  csChargingProfiles: unknown;
}

export interface ClearChargingProfileRequest {
  id?: number;
  connectorId?: number;
  chargingProfilePurpose?: string;
  stackLevel?: number;
}

// ---------------------------------------------------------------------------
// Simulator configuration
// ---------------------------------------------------------------------------

export interface ConnectorConfig {
  id: number;
  maxPowerWatts: number;    // e.g. 22000 for 22 kW
  voltage: number;           // e.g. 230
  phases: number;            // 1 or 3
}

export interface SimulatorConfig {
  /** Full ws:// URL up to (but not including) the charger ID.
   *  Format: ws://host:port/OCPP16/<tenantId>/<tokenId>
   */
  serverUrl: string;

  /** Charger identifier registered in the ev-server */
  chargingStationId: string;

  /** Charger metadata sent in BootNotification */
  vendor: string;
  model: string;
  serialNumber?: string;
  firmwareVersion?: string;

  /** Connectors on this charger */
  connectors: ConnectorConfig[];

  /** Heartbeat interval in seconds (overridden by server response) */
  heartbeatIntervalSecs: number;

  /** Meter value reporting interval in seconds during a transaction */
  meterValueIntervalSecs: number;

  /** Timeout for outgoing OCPP requests in seconds (default: 30) */
  requestTimeoutSecs?: number;

  /** Whether to log all raw OCPP messages */
  verbose: boolean;
}

// ---------------------------------------------------------------------------
// Internal simulator state
// ---------------------------------------------------------------------------

export interface ConnectorState {
  id: number;
  status: ChargePointStatus;
  transactionId: number | null;
  meterValue: number;       // cumulative Wh
  sessionStartMeter: number;
  sessionStartTime: Date | null;
  idTag: string | null;
}
