/**
 * mqttService.js
 * ──────────────
 * Production fleet telemetry pipeline:
 *   OBD-II Device → BLE → Driver Mobile App → Internet → MQTT Broker →
 *   Node.js Subscriber (this file) → Appwrite Database → Web Dashboard
 *
 * Topic structure:
 *   fleet/{busId}/telemetry   — primary topic (mobile app publishes here)
 *   fleet/{busId}/obd         — legacy / simulator topic
 *   Wildcard subscription:  fleet/+/telemetry   (all 30+ buses)
 *
 * Unique Client ID per bus: bus_TN25AB1234 (registration number)
 * Transmission interval: 3 minutes (configurable)
 *
 * OBD-II Parameters stored (20+ PIDs):
 *   Speed, RPM, Coolant Temp, Engine Load, Fuel Level, Battery Voltage,
 *   Throttle Position, Mass Air Flow, Intake Air Temp, Fuel Pressure,
 *   Short-Term Fuel Trim, Long-Term Fuel Trim, Engine Runtime,
 *   Distance Since Codes Cleared, Oxygen Sensors, Odometer,
 *   Ignition Status, Engine Temperature, Oil Temp, Oil Pressure,
 *   Timing Advance, Barometric Pressure, Catalyst Temp
 *   + ANY additional fields sent dynamically (never stripped)
 *
 * Appwrite writes:
 *   buses/<busId>           – live snapshot (obd + status + updatedAt)
 *   obd_history/<auto-id>   – immutable log for analytics / history
 *
 * Socket.IO events emitted to all clients:
 *   'obdUpdate'    { busId, timestamp, parameters, faultCodes }
 *   'busUpdate'    { busId, obd, status, updatedAt }
 *   'faultAlert'   { busId, faultCodes, timestamp }   — only when DTCs present
 */

import mqtt from 'mqtt';
import { db, DB_ID, COLL, ID } from '../config/appwrite.js';

/* ── Mutable config — can be set at runtime from Settings API ─────────── */
let mqttUrl      = process.env.MQTT_URL      || null;
let mqttUsername  = process.env.MQTT_USERNAME || null;
let mqttPassword  = process.env.MQTT_PASSWORD || null;
// Subscribe to both topic formats — /telemetry (mobile app) and /obd (legacy simulators)
let mqttTopics   = (process.env.MQTT_TOPIC || '').split(',').map(t => t.trim()).filter(Boolean);
if (!mqttTopics.length) { mqttTopics = ['fleet/+/telemetry', 'fleet/+/obd']; }

/* ── Module state ─────────────────────────────────────────────────────────── */
const PERSIST_INTERVAL_MS = 3 * 60 * 1000;   // 3 minutes — matches OBD transmission interval

const state = {
  client:        null,
  connected:     false,
  latest:        new Map(),   // busId → latest normalized OBD payload (in-memory, no DB hit)
  lastPersisted: new Map(),   // busId → timestamp of last successful Appwrite write
  io:            null,        // Socket.IO server instance (injected by initMqtt)
  busCount:      0,           // total unique buses seen this session
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const extractBusId = (topic, payload) => {
  // 1. Explicit busId in payload (highest priority)
  if (payload?.busId) return payload.busId;
  // 2. Extract from topic: fleet/{busId}/telemetry or fleet/{busId}/obd
  const parts    = topic.split('/');
  const fleetIdx = parts.findIndex((p) => p === 'fleet');
  return fleetIdx >= 0 && parts[fleetIdx + 1] ? parts[fleetIdx + 1] : null;
};

/**
 * KNOWN OBD-II PID ALIASES
 * Maps common alternative key names to our canonical parameter names.
 * This allows mobile apps and OBD devices to send data in any format.
 */
const KNOWN_ALIASES = {
  // Location
  lat:            ['lat', 'latitude', 'Latitude', 'GPS_LAT'],
  lng:            ['lng', 'longitude', 'Longitude', 'GPS_LNG', 'lon'],
  // PID 0x0D — Vehicle Speed
  speed:          ['speed', 'vehicleSpeed', 'Speed', 'vehicle_speed', 'SPEED'],
  // PID 0x0C — Engine RPM
  rpm:            ['rpm', 'engineRpm', 'RPM', 'engine_rpm', 'ENGINE_RPM'],
  // PID 0x2F — Fuel Tank Level Input
  fuelLevel:      ['fuelLevel', 'fuel_level', 'FuelLevel', 'FUEL_LEVEL', 'fuelTankLevel'],
  // PID 0x42 — Control Module Voltage (Battery)
  batteryVoltage: ['batteryVoltage', 'battery_voltage', 'BatteryVoltage', 'BATTERY_VOLTAGE', 'controlModuleVoltage'],
  // PID 0x05 — Engine Coolant Temperature
  coolantTemp:    ['coolantTemp', 'coolant_temp', 'EngineCoolantTemp', 'COOLANT_TEMP', 'engineCoolantTemp'],
  // PID 0x04 — Calculated Engine Load
  engineLoad:     ['engineLoad', 'engine_load', 'EngineLoad', 'ENGINE_LOAD', 'calculatedEngineLoad'],
  // PID 0x11 — Throttle Position
  throttlePosition: ['throttlePosition', 'throttle_position', 'ThrottlePosition', 'THROTTLE_POS', 'throttle'],
  // PID 0x10 — Mass Air Flow Rate
  massAirFlow:    ['massAirFlow', 'mass_air_flow', 'MassAirFlow', 'MAF', 'mafAirFlow', 'maf'],
  // PID 0x0F — Intake Air Temperature
  intakeAirTemp:  ['intakeAirTemp', 'intake_air_temp', 'IntakeAirTemp', 'INTAKE_AIR_TEMP', 'intakeTemp'],
  // PID 0x0A — Fuel Pressure (gauge)
  fuelPressure:   ['fuelPressure', 'fuel_pressure', 'FuelPressure', 'FUEL_PRESSURE'],
  // PID 0x06 — Short Term Fuel Trim (Bank 1)
  shortTermFuelTrim: ['shortTermFuelTrim', 'short_term_fuel_trim', 'STFT', 'stft_b1', 'ShortTermFuelTrim'],
  // PID 0x07 — Long Term Fuel Trim (Bank 1)
  longTermFuelTrim:  ['longTermFuelTrim', 'long_term_fuel_trim', 'LTFT', 'ltft_b1', 'LongTermFuelTrim'],
  // PID 0x1F — Run Time Since Engine Start
  engineRuntime:  ['engineRuntime', 'engine_runtime', 'EngineRuntime', 'ENGINE_RUNTIME', 'runTime', 'run_time'],
  // PID 0x31 — Distance Since Codes Cleared
  distanceSinceCodesCleared: ['distanceSinceCodesCleared', 'distance_since_codes_cleared', 'DistanceSinceCodesCleared', 'DIST_CODES_CLEARED'],
  // PID 0x14-0x1B — Oxygen Sensors
  oxygenSensors:  ['oxygenSensors', 'oxygen_sensors', 'OxygenSensors', 'O2_SENSORS', 'o2Sensors'],
  // Odometer (PID 0xA6 or derived)
  odometer:       ['odometer', 'distanceTravelled', 'Odometer', 'ODOMETER', 'totalDistance'],
  // Ignition status
  ignition:       ['ignition', 'ignitionStatus', 'Ignition', 'IGNITION', 'ignition_status'],
  // Engine Temperature (alternate to coolant)
  engineTemperature: ['engineTemperature', 'engine_temperature', 'EngineTemperature', 'ENGINE_TEMP', 'engineTemp'],
  // Oil Temperature
  oilTemp:        ['oilTemp', 'oil_temp', 'OilTemp', 'OIL_TEMP', 'oilTemperature'],
  // Oil Pressure
  oilPressure:    ['oilPressure', 'oil_pressure', 'OilPressure', 'OIL_PRESSURE'],
  // PID 0x0E — Timing Advance
  timingAdvance:  ['timingAdvance', 'timing_advance', 'TimingAdvance', 'TIMING_ADVANCE'],
  // PID 0x33 — Barometric Pressure
  barometricPressure: ['barometricPressure', 'barometric_pressure', 'BarometricPressure', 'BARO_PRESSURE'],
  // PID 0x3C — Catalyst Temperature (Bank 1, Sensor 1)
  catalystTemp:   ['catalystTemp', 'catalyst_temp', 'CatalystTemp', 'CATALYST_TEMP'],
  // PID 0x0B — Intake Manifold Absolute Pressure
  manifoldPressure: ['manifoldPressure', 'manifold_pressure', 'ManifoldPressure', 'MAP', 'intakeManifoldPressure'],
};

/**
 * Normalizes ANY incoming OBD telemetry payload to canonical parameter names.
 * Supports 20+ OBD-II PIDs plus DYNAMIC parameter storage — unknown fields
 * are preserved in the output, never stripped.
 *
 * Accepts flat payloads, nested {parameters}, nested {obd}, or {obd:{parameters}}.
 */
const normalizePayload = (raw) => {
  // Allow nested shapes: { parameters: {...} }, { obd: {...} }, { obd: { parameters: {...} } }
  const src = raw?.obd?.parameters ?? raw?.parameters ?? raw?.obd ?? raw;

  // Build a flat lookup of all source keys for alias matching
  const srcKeys = new Set(Object.keys(src));

  // Resolve each known parameter using alias list
  const parameters = {};
  const matchedKeys = new Set();

  for (const [canonical, aliases] of Object.entries(KNOWN_ALIASES)) {
    let value = null;
    for (const alias of aliases) {
      if (src[alias] !== undefined && src[alias] !== null) {
        value = src[alias];
        matchedKeys.add(alias);
        break;
      }
    }
    parameters[canonical] = value;
  }

  // DYNAMIC PARAMETER STORAGE: preserve any fields NOT matched by known aliases
  // This ensures future OBD parameters or custom device fields are never lost
  for (const key of srcKeys) {
    if (!matchedKeys.has(key) && parameters[key] === undefined) {
      // Skip metadata fields that aren't OBD parameters
      if (['busId', 'deviceId', 'clientId', 'timestamp', 'type', 'version'].includes(key)) continue;
      parameters[key] = src[key];
    }
  }

  // Extract fault/DTC codes from multiple possible locations
  const faultCodes = raw?.faultCodes ?? raw?.dtcCodes ?? raw?.diagnosticTroubleCodes
    ?? src?.faultCodes ?? src?.dtcCodes ?? [];

  return { parameters, faultCodes };
};

/* ── Appwrite helpers ────────────────────────────────────────────────────── */

/**
 * Auto-register a bus document in Appwrite when first telemetry arrives.
 * This allows new buses to appear automatically without manual creation.
 */
const autoRegisterBus = async (busId, normalized, timestamp) => {
  try {
    const { lat, lng, ...obdFields } = normalized.parameters;
    const locationJson = (lat != null && lng != null) ? JSON.stringify({ lat, lng, timestamp }) : JSON.stringify({});
    await db.createDocument(DB_ID, COLL.BUSES, busId, {
      busName:            busId,
      registrationNumber: busId.replace('bus_', '').replace(/_/g, ''),
      route:              '',
      driverName:         '',
      model:              '',
      capacity:           50,
      etaMinutes:         0,
      status:             'active',
      obd:                JSON.stringify({ parameters: obdFields, faultCodes: normalized.faultCodes }),
      location:           locationJson,
      updatedAt:          timestamp,
    });
    state.busCount++;
    console.log(`[mqtt] ✓ Auto-registered new bus: ${busId} (fleet total: ${state.busCount})`);
    return true;
  } catch (e) {
    if (e?.code === 409) return false; // already existed, race condition
    console.warn(`[mqtt] Auto-register failed for ${busId}:`, e.message);
    return false;
  }
};

/**
 * Persists telemetry to Appwrite:
 *   1. Updates live bus snapshot (or auto-registers if new)
 *   2. Appends immutable telemetry history record with ALL parameters (dynamic storage)
 */
const persistToAppwrite = async (busId, normalized, timestamp) => {
  const { lat, lng, ...obdFields } = normalized.parameters;
  const locationJson = (lat != null && lng != null)
    ? JSON.stringify({ lat, lng, timestamp })
    : undefined;

  try {
    // 1. Update the live bus snapshot (location + OBD fields separately)
    const patch = {
      obd:       JSON.stringify({ parameters: obdFields, faultCodes: normalized.faultCodes }),
      status:    'active',
      updatedAt: timestamp,
    };
    if (locationJson) patch.location = locationJson;
    await db.updateDocument(DB_ID, COLL.BUSES, busId, patch);
  } catch (busErr) {
    // Bus document may not exist — auto-register it
    if (busErr?.code === 404 || busErr?.message?.includes('not found')) {
      await autoRegisterBus(busId, normalized, timestamp);
    } else {
      console.warn(`[mqtt] Bus doc update failed for ${busId}:`, busErr.message);
    }
  }

  try {
    // 2. Append immutable telemetry history record (stores ALL parameters including dynamic ones)
    await db.createDocument(DB_ID, COLL.OBD_HISTORY, ID.unique(), {
      busId,
      timestamp,
      parameters: JSON.stringify(normalized.parameters),   // Full payload — never stripped
      faultCodes: JSON.stringify(normalized.faultCodes),
    });
  } catch (histErr) {
    console.error(`[mqtt] History write failed for ${busId}:`, histErr.message);
  }
};

/* ── Socket.IO broadcast ─────────────────────────────────────────────────── */

const broadcastToClients = (busId, normalized, timestamp) => {
  if (!state.io) return;

  const { lat, lng, ...obdFields } = normalized.parameters;

  // Full telemetry event — consumed by Socket.IO listeners in the web app
  state.io.emit('obdUpdate', { busId, timestamp, parameters: obdFields, faultCodes: normalized.faultCodes });

  // Bus status event — also carries location so the map pin moves in real-time
  state.io.emit('busUpdate', {
    busId,
    status:    'active',
    updatedAt: timestamp,
    location:  (lat != null && lng != null) ? { lat, lng } : undefined,
    obd:       { parameters: obdFields, faultCodes: normalized.faultCodes },
  });

  if (normalized.faultCodes?.length > 0) {
    state.io.emit('faultAlert', { busId, faultCodes: normalized.faultCodes, timestamp });
  }
};

/* ── Main init ───────────────────────────────────────────────────────────── */

/**
 * Call once from index.js after Socket.IO is ready.
 * @param {import('socket.io').Server|null} io – Socket.IO server for real-time broadcast
 */
/**
 * Call once from index.js after Socket.IO is ready.
 * @param {import('socket.io').Server|null} io – Socket.IO server for real-time broadcast
 */
const initMqtt = (io = null) => {
  state.io = io;

  if (!mqttUrl) {
    console.log('[mqtt] MQTT_URL not set — MQTT disabled (Demo Mode)');
    return;
  }
  if (state.client) return;

  const options = { clientId: `livefleet-server-${Date.now()}` };
  if (mqttUsername) { options.username = mqttUsername; options.password = mqttPassword; }

  console.log(`[mqtt] Connecting to ${mqttUrl} …`);
  console.log(`[mqtt] Topics: ${mqttTopics.join(', ')}`);
  console.log(`[mqtt] Persist interval: ${PERSIST_INTERVAL_MS / 1000}s`);
  state.client = mqtt.connect(mqttUrl, options);

  state.client.on('connect', () => {
    state.connected = true;
    console.log(`[mqtt] ✓ Connected to broker. Subscribing to ${mqttTopics.length} topic(s)…`);
    mqttTopics.forEach(topic => {
      state.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) console.error(`[mqtt] Subscribe error (${topic}):`, err.message);
        else console.log(`[mqtt]   ✓ Subscribed: ${topic}`);
      });
    });
  });

  /* ── Core message handler: cache → Appwrite (3-min throttle) → Socket.IO ── */
  state.client.on('message', async (topic, message) => {
    let payload;
    try { payload = JSON.parse(message.toString()); }
    catch { console.warn('[mqtt] Non-JSON on', topic); return; }

    const busId = extractBusId(topic, payload);
    if (!busId) { console.warn('[mqtt] No busId from topic:', topic); return; }

    const now        = Date.now();
    const timestamp  = new Date(now).toISOString();
    const normalized = normalizePayload(payload);

    // 1. In-memory cache — instant reads via /api/obd-live/:busId (no DB hit)
    state.latest.set(busId, { busId, timestamp, ...normalized });
    if (!state.lastPersisted.has(busId)) {
      state.busCount++;
      console.log(`[mqtt] New bus detected: ${busId} (fleet total: ${state.busCount}) — ${Object.keys(normalized.parameters).filter(k => normalized.parameters[k] != null).length} parameters`);
    }

    // 2. Persist to Appwrite only once every 3 minutes per bus (API rate limit)
    const lastWrite = state.lastPersisted.get(busId) || 0;
    if (now - lastWrite >= PERSIST_INTERVAL_MS) {
      state.lastPersisted.set(busId, now);
      persistToAppwrite(busId, normalized, timestamp);
      console.log(`[mqtt] ${busId} → DB write (3-min tick) speed=${normalized.parameters?.speed ?? '-'} faults=${normalized.faultCodes.length}`);
    } else {
      const secsLeft = Math.round((PERSIST_INTERVAL_MS - (now - lastWrite)) / 1000);
      console.log(`[mqtt] ${busId} → cache-only (DB write in ${secsLeft}s) speed=${normalized.parameters?.speed ?? '-'}`);
    }

    // 3. Broadcast to all connected Socket.IO clients (always — real-time UI)
    broadcastToClients(busId, normalized, timestamp);
  });

  state.client.on('error',     (err) => { state.connected = false; console.error('[mqtt] Error:', err.message); });
  state.client.on('close',     ()    => { state.connected = false; console.log('[mqtt] Disconnected'); });
  state.client.on('reconnect', ()    => console.log('[mqtt] Reconnecting…'));
};

/* ── Public API ──────────────────────────────────────────────────────────── */
const isConfigured     = ()       => Boolean(mqttUrl);
const isConnected      = ()       => state.connected;
const getLatestObdData = (busId)  => state.latest.get(busId) || null;
const getAllLatest      = ()       => Object.fromEntries(state.latest);
const getBusCount       = ()       => state.busCount;
const getConnectedBuses = ()       => Array.from(state.latest.keys());

/**
 * Returns detailed MQTT status for the Settings page.
 */
const getMqttStatus = () => ({
  configured: Boolean(mqttUrl),
  connected:  state.connected,
  brokerUrl:  mqttUrl || '',
  topics:     mqttTopics,
  busCount:   state.busCount,
  connectedBuses: Array.from(state.latest.keys()),
});

/**
 * Dynamically configure and connect to an MQTT broker at runtime.
 * Called from the Settings page "Connect MQTT" button.
 */
const configureMqtt = (config) => {
  // Disconnect existing client if any
  if (state.client) {
    try { state.client.end(true); } catch { /* ignore */ }
    state.client = null;
    state.connected = false;
  }

  // Apply new config
  mqttUrl     = config.brokerUrl || config.url || null;
  mqttUsername = config.username || null;
  mqttPassword = config.password || null;
  if (config.topic) {
    mqttTopics = config.topic.split(',').map(t => t.trim()).filter(Boolean);
    if (!mqttTopics.length) mqttTopics = ['fleet/+/telemetry', 'fleet/+/obd'];
  }

  if (!mqttUrl) {
    return { success: false, error: 'Broker URL is required' };
  }

  // Re-init with new config
  initMqtt(state.io);
  return { success: true, message: `Connecting to ${mqttUrl}…` };
};

/**
 * Gracefully disconnect from the MQTT broker.
 */
const disconnectMqtt = () => {
  if (state.client) {
    try { state.client.end(true); } catch { /* ignore */ }
    state.client = null;
    state.connected = false;
    console.log('[mqtt] Disconnected by user');
    return { success: true, message: 'MQTT disconnected' };
  }
  return { success: true, message: 'MQTT was not connected' };
};

export {
  initMqtt, isConfigured, isConnected,
  getLatestObdData, getAllLatest, getBusCount, getConnectedBuses,
  getMqttStatus, configureMqtt, disconnectMqtt,
};
