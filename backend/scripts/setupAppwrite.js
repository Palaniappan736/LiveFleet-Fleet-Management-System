/**
 * setupAppwrite.js
 * ─────────────────
 * One-time setup script: creates the Appwrite database and all collections
 * with the required attributes and indexes.
 *
 * Run once:  node backend/scripts/setupAppwrite.js
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

/* ── helpers ─────────────────────────────────────────────────────────────── */

const tryCreate = async (label, fn) => {
  try   { const r = await fn(); console.log(`  ✓  ${label}`); return r; }
  catch (e) {
    if (e?.code === 409) { console.log(`  –  ${label} (already exists)`); }
    else                 { console.warn(`  ⚠  ${label}: ${e.message}`); }
  }
};

const str  = (key, size = 255, req = false) => ({ key, type: 'string',  size,    required: req });
const int  = (key, req = false, def = null) => ({ key, type: 'integer', required: req, default: def });
const bool = (key, req = false, def = null) => ({ key, type: 'boolean', required: req, default: def });

const addAttr = (dbId, collId, attr) => {
  switch (attr.type) {
    case 'string':  return db.createStringAttribute (dbId, collId, attr.key, attr.size ?? 255, !!attr.required, attr.default ?? null, false);
    case 'integer': return db.createIntegerAttribute(dbId, collId, attr.key, !!attr.required, undefined, undefined, attr.default ?? null, false);
    case 'boolean': return db.createBooleanAttribute(dbId, collId, attr.key, !!attr.required, attr.default ?? null, false);
    default: throw new Error(`Unknown attr type: ${attr.type}`);
  }
};

/* ── main ─────────────────────────────────────────────────────────────────  */

async function setup() {
  console.log('\n🔧  LiveFleet — Appwrite Setup\n');

  /* ── 1. Database ─────────────────────────────────────────────────────── */
  console.log('Creating database …');
  await tryCreate(`Database "${DB_ID}"`, () => db.create(DB_ID, 'LiveFleet'));

  // Brief wait so the DB is ready
  await new Promise((r) => setTimeout(r, 1500));

  /* ── 2. buses collection ─────────────────────────────────────────────── */
  console.log('\nCreating "buses" collection …');
  await tryCreate('Collection buses', () =>
    db.createCollection(DB_ID, 'buses', 'Buses', [
      'read("any")',
      'create("users")',
      'update("users")',
      'delete("users")',
    ]),
  );

  await new Promise((r) => setTimeout(r, 800));

  const busAttrs = [
    str('busName',            100, true),
    str('registrationNumber', 50,  false),
    str('route',              200, false),
    str('status',             50,  false),
    str('driverName',         100, false),
    int('capacity',           false, 50),
    int('etaMinutes',         false, 0),
    str('model',              100, false),
    str('obd',               10000, false),
    str('location',           500, false),
    str('updatedAt',          50,  false),
  ];

  for (const attr of busAttrs) {
    await tryCreate(`  buses.${attr.key}`, () => addAttr(DB_ID, 'buses', attr));
    await new Promise((r) => setTimeout(r, 400));
  }

  /* ── 3. users collection ─────────────────────────────────────────────── */
  console.log('\nCreating "users" collection …');
  await tryCreate('Collection users', () =>
    db.createCollection(DB_ID, 'users', 'Users', [
      'read("any")',
      'create("users")',
      'update("users")',
      'delete("users")',
    ]),
  );

  await new Promise((r) => setTimeout(r, 800));

  const userAttrs = [
    str('userId',      100, true),
    str('name',        100, false),
    str('email',       200, true),
    str('role',         50, false),
    str('status',       50, false),
    str('assignedBus', 100, false),
    str('phone',       100, false),
  ];

  for (const attr of userAttrs) {
    await tryCreate(`  users.${attr.key}`, () => addAttr(DB_ID, 'users', attr));
    await new Promise((r) => setTimeout(r, 400));
  }

  /* ── 4. obd_history collection ───────────────────────────────────────── */
  console.log('\nCreating "obd_history" collection …');
  await tryCreate('Collection obd_history', () =>
    db.createCollection(DB_ID, 'obd_history', 'OBD History', [
      'read("any")',
      'create("users")',
    ]),
  );

  await new Promise((r) => setTimeout(r, 800));

  const histAttrs = [
    str('busId',      100,  true),
    str('timestamp',   50,  false),
    str('parameters', 10000, false),
    str('faultCodes',  5000, false),
  ];

  for (const attr of histAttrs) {
    await tryCreate(`  obd_history.${attr.key}`, () => addAttr(DB_ID, 'obd_history', attr));
    await new Promise((r) => setTimeout(r, 400));
  }

  /* ── 5. Indexes ───────────────────────────────────────────────────────── */
  console.log('\nCreating indexes …');
  await new Promise((r) => setTimeout(r, 1000));

  await tryCreate('Index: obd_history.busId', () =>
    db.createIndex(DB_ID, 'obd_history', 'busId_idx', 'key', ['busId'], ['ASC']),
  );
  await new Promise((r) => setTimeout(r, 600));

  await tryCreate('Index: obd_history.timestamp', () =>
    db.createIndex(DB_ID, 'obd_history', 'timestamp_idx', 'key', ['timestamp'], ['DESC']),
  );
  await new Promise((r) => setTimeout(r, 600));

  await tryCreate('Index: users.userId', () =>
    db.createIndex(DB_ID, 'users', 'userId_idx', 'key', ['userId'], ['ASC']),
  );

  /* ── 5b. Additional collections ──────────────────────────────────────── */

  // alerts
  console.log('\nCreating "alerts" collection …');
  await tryCreate('Collection alerts', () =>
    db.createCollection(DB_ID, 'alerts', 'Alerts', ['read("any")', 'create("users")', 'update("users")', 'delete("users")']),
  );
  await new Promise((r) => setTimeout(r, 800));
  for (const attr of [str('busId',100,false),str('type',100,false),str('message',500,false),str('severity',50,false),{key:'read',type:'boolean',required:false,default:false},str('createdAt',50,false)]) {
    await tryCreate(`  alerts.${attr.key}`, () => addAttr(DB_ID, 'alerts', attr));
    await new Promise((r) => setTimeout(r, 400));
  }

  // drivers
  console.log('\nCreating "drivers" collection …');
  await tryCreate('Collection drivers', () =>
    db.createCollection(DB_ID, 'drivers', 'Drivers', ['read("any")', 'create("users")', 'update("users")', 'delete("users")']),
  );
  await new Promise((r) => setTimeout(r, 800));
  for (const attr of [str('name',100,false),str('phone',50,false),str('licenseNumber',100,false),str('email',200,false),str('status',50,false),str('createdAt',50,false)]) {
    await tryCreate(`  drivers.${attr.key}`, () => addAttr(DB_ID, 'drivers', attr));
    await new Promise((r) => setTimeout(r, 400));
  }

  // routes
  console.log('\nCreating "routes" collection …');
  await tryCreate('Collection routes', () =>
    db.createCollection(DB_ID, 'routes', 'Routes', ['read("any")', 'create("users")', 'update("users")', 'delete("users")']),
  );
  await new Promise((r) => setTimeout(r, 800));
  for (const attr of [str('routeName',200,false),str('stops',10000,false),str('createdAt',50,false)]) {
    await tryCreate(`  routes.${attr.key}`, () => addAttr(DB_ID, 'routes', attr));
    await new Promise((r) => setTimeout(r, 400));
  }

  // maintenance
  console.log('\nCreating "maintenance" collection …');
  await tryCreate('Collection maintenance', () =>
    db.createCollection(DB_ID, 'maintenance', 'Maintenance', ['read("any")', 'create("users")', 'update("users")', 'delete("users")']),
  );
  await new Promise((r) => setTimeout(r, 800));
  for (const attr of [str('busId',100,false),str('issue',500,false),str('status',50,false),str('priority',50,false),str('scheduledDate',50,false),str('createdAt',50,false),str('notes',1000,false)]) {
    await tryCreate(`  maintenance.${attr.key}`, () => addAttr(DB_ID, 'maintenance', attr));
    await new Promise((r) => setTimeout(r, 400));
  }

  // fuel
  console.log('\nCreating "fuel" collection …');
  await tryCreate('Collection fuel', () =>
    db.createCollection(DB_ID, 'fuel', 'Fuel', ['read("any")', 'create("users")', 'update("users")']),
  );
  await new Promise((r) => setTimeout(r, 800));
  for (const attr of [str('busId',100,false),{key:'fuelLevel',type:'integer',required:false,default:100},str('timestamp',50,false)]) {
    await tryCreate(`  fuel.${attr.key}`, () => addAttr(DB_ID, 'fuel', attr));
    await new Promise((r) => setTimeout(r, 400));
  }

  // geofences
  console.log('\nCreating "geofences" collection …');
  await tryCreate('Collection geofences', () =>
    db.createCollection(DB_ID, 'geofences', 'Geofences', ['read("any")', 'create("users")', 'update("users")', 'delete("users")']),
  );
  await new Promise((r) => setTimeout(r, 800));
  for (const attr of [str('name',200,false),{key:'centerLat',type:'string',size:50,required:false},{key:'centerLng',type:'string',size:50,required:false},{key:'radius',type:'integer',required:false,default:500}]) {
    await tryCreate(`  geofences.${attr.key}`, () => addAttr(DB_ID, 'geofences', attr));
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('\n✅  Appwrite setup complete!\n');
  console.log('Next steps:');
  console.log('  1. node backend/scripts/seedAppwrite.js   (seed demo buses)');
  console.log('  2. node backend/scripts/makeAdmin.js      (create admin user)\n');
  process.exit(0);
}

setup().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
