/**
 * mqttSimulator.js
 * ────────────────
 * Simulates 30 buses publishing telemetry to the MQTT broker.
 * Useful for testing the full pipeline without real OBD-II devices.
 *
 * Usage:
 *   node backend/scripts/mqttSimulator.js                   # 30 buses, 3-min interval
 *   BUSES=5 INTERVAL=10 node backend/scripts/mqttSimulator.js  # 5 buses, 10s interval
 *
 * Env vars (from .env):
 *   MQTT_URL       – broker URL  (e.g. mqtt://broker.hivemq.com:1883)
 *   MQTT_USERNAME  – optional
 *   MQTT_PASSWORD  – optional
 */

import dotenv from 'dotenv';
dotenv.config();

import mqtt from 'mqtt';

/* ── Configuration ────────────────────────────────────────────────────────── */

const MQTT_URL      = process.env.MQTT_URL      || 'mqtt://broker.hivemq.com:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME  || undefined;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD  || undefined;
const BUS_COUNT     = parseInt(process.env.BUSES    || '30', 10);
const INTERVAL_SEC  = parseInt(process.env.INTERVAL || '180', 10);  // default 3 min

/* ── Bus fleet definitions ────────────────────────────────────────────────── */

const REGISTRATIONS = [
  'TN25AB1234', 'TN25CD5678', 'TN25EF9012', 'TN25GH3456', 'TN25IJ7890',
  'TN25KL1122', 'TN25MN3344', 'TN25OP5566', 'TN25QR7788', 'TN25ST9900',
  'TN26AB1111', 'TN26CD2222', 'TN26EF3333', 'TN26GH4444', 'TN26IJ5555',
  'TN26KL6666', 'TN26MN7777', 'TN26OP8888', 'TN26QR9999', 'TN26ST1010',
  'TN27AB2020', 'TN27CD3030', 'TN27EF4040', 'TN27GH5050', 'TN27IJ6060',
  'TN27KL7070', 'TN27MN8080', 'TN27OP9090', 'TN27QR1212', 'TN27ST1313',
];

const ROUTES = [
  'Route A - Campus → City Center',
  'Route B - Hostel → Main Gate',
  'Route C - Library → Station',
  'Route D - Market → Campus',
  'Route E - Airport → University',
];

/* ── Helper functions ─────────────────────────────────────────────────────── */

const rand  = (min, max) => Math.random() * (max - min) + min;
const randI = (min, max) => Math.round(rand(min, max));
const jitter = (base, pct = 0.05) => base + base * (Math.random() - 0.5) * 2 * pct;

/** Simulates realistic GPS movement within a bounding box (Chennai area) */
const gpsState = {};
const getGps = (busId) => {
  if (!gpsState[busId]) {
    gpsState[busId] = {
      lat: rand(12.95, 13.15),   // Chennai latitude range
      lng: rand(80.15, 80.30),   // Chennai longitude range
      headingLat: (Math.random() - 0.5) * 0.002,
      headingLng: (Math.random() - 0.5) * 0.002,
    };
  }
  const g = gpsState[busId];
  // Slight random walk
  g.lat += g.headingLat + (Math.random() - 0.5) * 0.0005;
  g.lng += g.headingLng + (Math.random() - 0.5) * 0.0005;
  // Bounce off bounding box
  if (g.lat < 12.90 || g.lat > 13.20) g.headingLat *= -1;
  if (g.lng < 80.10 || g.lng > 80.35) g.headingLng *= -1;
  return { lat: parseFloat(g.lat.toFixed(6)), lng: parseFloat(g.lng.toFixed(6)) };
};

/** Per-bus persistent state for cumulative counters */
const busState = {};
const getBusState = (busId) => {
  if (!busState[busId]) {
    busState[busId] = {
      odometer:      randI(12000, 90000),
      engineRuntime: randI(300, 28800),
      distanceSinceCodesCleared: randI(100, 8000),
      tickCount:     0,
    };
  }
  return busState[busId];
};

/**
 * Generate a full OBD-II telemetry payload with 25+ realistic parameters.
 */
const generatePayload = (busId) => {
  const gps = getGps(busId);
  const bs  = getBusState(busId);
  bs.tickCount++;
  bs.odometer      += rand(0.01, 0.08);
  bs.engineRuntime += INTERVAL_SEC;
  bs.distanceSinceCodesCleared += rand(0.5, 3);

  const speed      = randI(0, 80);
  const rpm        = speed === 0 ? randI(600, 900) : randI(1200, 4500);
  const engineLoad = speed === 0 ? rand(15, 30) : rand(25, 85);

  // Occasional DTC codes (~5% chance)
  const faultCodes = Math.random() < 0.05
    ? [`P${randI(100, 999).toString().padStart(4, '0')}`]
    : [];

  return {
    busId,
    timestamp: new Date().toISOString(),

    // ── Core PIDs ──────────────────────────────────────────────
    speed:            speed,
    rpm:              rpm,
    fuelLevel:        parseFloat(rand(15, 95).toFixed(1)),
    coolantTemp:      parseFloat(rand(75, 105).toFixed(1)),
    batteryVoltage:   parseFloat(rand(12.2, 14.8).toFixed(2)),
    engineLoad:       parseFloat(engineLoad.toFixed(1)),
    engineTemperature: parseFloat(rand(80, 110).toFixed(1)),

    // ── Extended PIDs ──────────────────────────────────────────
    throttlePosition:  parseFloat(rand(10, 85).toFixed(1)),
    massAirFlow:       parseFloat(rand(2, 250).toFixed(2)),
    intakeAirTemp:     parseFloat(rand(20, 55).toFixed(1)),
    fuelPressure:      randI(150, 450),
    shortTermFuelTrim: parseFloat(rand(-10, 10).toFixed(1)),
    longTermFuelTrim:  parseFloat(rand(-8, 8).toFixed(1)),
    engineRuntime:     Math.round(bs.engineRuntime),
    distanceSinceCodesCleared: Math.round(bs.distanceSinceCodesCleared),
    oxygenSensors:     parseFloat(rand(0.1, 0.9).toFixed(2)),
    odometer:          Math.round(bs.odometer),
    ignition:          true,
    oilTemp:           parseFloat(rand(85, 120).toFixed(1)),
    oilPressure:       parseFloat(rand(25, 65).toFixed(1)),
    timingAdvance:     parseFloat(rand(-5, 40).toFixed(1)),
    barometricPressure: randI(95, 105),
    catalystTemp:      parseFloat(rand(250, 650).toFixed(1)),
    manifoldPressure:  randI(30, 100),

    // ── Location ───────────────────────────────────────────────
    lat: gps.lat,
    lng: gps.lng,

    // ── Fault Codes ────────────────────────────────────────────
    faultCodes,
  };
};

/* ── Main ─────────────────────────────────────────────────────────────────── */

function main() {
  console.log('\n🚌  LiveFleet MQTT Simulator');
  console.log(`   Broker:   ${MQTT_URL}`);
  console.log(`   Buses:    ${BUS_COUNT}`);
  console.log(`   Interval: ${INTERVAL_SEC}s`);
  console.log();

  const buses = REGISTRATIONS.slice(0, BUS_COUNT).map((reg, i) => ({
    id:    `bus_${reg}`,
    reg,
    route: ROUTES[i % ROUTES.length],
  }));

  const options = { clientId: `livefleet-simulator-${Date.now()}` };
  if (MQTT_USERNAME) { options.username = MQTT_USERNAME; options.password = MQTT_PASSWORD; }

  const client = mqtt.connect(MQTT_URL, options);

  client.on('connect', () => {
    console.log('✓ Connected to MQTT broker\n');

    const publishAll = () => {
      const now = new Date().toLocaleTimeString();
      console.log(`── Tick ${now} ── publishing ${buses.length} payloads ──`);

      for (const bus of buses) {
        const payload = generatePayload(bus.id);
        const topic   = `fleet/${bus.id}/telemetry`;
        client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
          if (err) console.error(`  ✗ ${bus.id}: ${err.message}`);
          else     console.log(`  ✓ ${bus.id}  speed=${payload.speed} rpm=${payload.rpm} fuel=${payload.fuelLevel}%`);
        });
      }
      console.log();
    };

    // First publish immediately, then every INTERVAL_SEC
    publishAll();
    setInterval(publishAll, INTERVAL_SEC * 1000);
  });

  client.on('error', (err) => {
    console.error('✗ MQTT error:', err.message);
  });

  client.on('close', () => {
    console.log('MQTT connection closed');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down simulator…');
    client.end(true, () => process.exit(0));
  });
}

main();
