/**
 * seedAppwrite.js
 * ────────────────
 * Seeds 10 demo buses into the Appwrite "buses" collection.
 * Run AFTER setupAppwrite.js:
 *
 *   node backend/scripts/seedAppwrite.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { Client, Databases, ID } from 'node-appwrite';

const ENDPOINT   = process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '6999d3e40018ddea5615';
const API_KEY    = process.env.APPWRITE_API_KEY;
const DB_ID      = process.env.APPWRITE_DB_ID      || 'livefleet';

if (!API_KEY) { console.error('❌ APPWRITE_API_KEY is not set in .env'); process.exit(1); }

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const db     = new Databases(client);

const DEMO_BUSES = [
  { busName: 'BUS-001', registrationNumber: 'KA01AB1234', route: 'Route A – City Centre ↔ Airport',     driverName: 'Ravi Kumar',    model: 'Tata Starbus 12m' },
  { busName: 'BUS-002', registrationNumber: 'KA02CD5678', route: 'Route B – Tech Park ↔ Railway Stn',   driverName: 'Suresh Nair',   model: 'Ashok Leyland Viking' },
  { busName: 'BUS-003', registrationNumber: 'KA03EF9012', route: 'Route C – University ↔ Hospital',     driverName: 'Mohan Das',     model: 'Volvo 9400' },
  { busName: 'BUS-004', registrationNumber: 'KA04GH3456', route: 'Route D – North Ring Road',           driverName: 'Anil Sharma',   model: 'Tata Marcopolo' },
  { busName: 'BUS-005', registrationNumber: 'KA05IJ7890', route: 'Route E – South Cross ↔ Bus Depot',   driverName: 'Vijay Reddy',   model: 'Ashok Leyland Lynx' },
  { busName: 'BUS-006', registrationNumber: 'KA06KL1234', route: 'Route F – Industrial Zone ↔ Market',  driverName: 'Prakash Rao',   model: 'Tata Starbus 9m' },
  { busName: 'BUS-007', registrationNumber: 'KA07MN5678', route: 'Route G – East–West Expressway',      driverName: 'Deepak Singh',  model: 'Volvo B8R' },
  { busName: 'BUS-008', registrationNumber: 'KA08OP9012', route: 'Route H – College Circuit',            driverName: 'Ramesh Gupta',  model: 'Eicher Skyline Pro' },
  { busName: 'BUS-009', registrationNumber: 'KA09QR3456', route: 'Route I – Night Service ↔ CBD',       driverName: 'Sanjay Patil',  model: 'Tata Starbus Ultra' },
  { busName: 'BUS-010', registrationNumber: 'KA10ST7890', route: 'Route J – Hill Station Express',      driverName: 'Arvind Joshi',  model: 'Volvo 9600' },
];

const defaultObd = JSON.stringify({
  parameters: {
    speed: 0, rpm: 0, fuelLevel: 100,
    engineTemp: 70, batteryVoltage: 12.6,
    throttle: 0, engineLoad: 0,
  },
  faultCodes: [],
});

const defaultLocation = JSON.stringify({ lat: 12.9716, lng: 77.5946, accuracy: 0 });

async function seed() {
  console.log('\n🌱  LiveFleet — Seeding Appwrite buses collection\n');

  for (const bus of DEMO_BUSES) {
    try {
      await db.createDocument(DB_ID, 'buses', ID.unique(), {
        busName:            bus.busName,
        registrationNumber: bus.registrationNumber,
        route:              bus.route,
        driverName:         bus.driverName,
        model:              bus.model,
        capacity:           50,
        etaMinutes:         Math.floor(Math.random() * 20) + 2,
        status:             'inactive',
        obd:                defaultObd,
        location:           defaultLocation,
        updatedAt:          new Date().toISOString(),
      });
      console.log(`  ✓  ${bus.busName}  (${bus.registrationNumber})`);
    } catch (e) {
      console.warn(`  ⚠  ${bus.busName}: ${e.message}`);
    }
    // small delay to avoid rate-limiting
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log('\n✅  Seed complete — 10 buses added to Appwrite\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
