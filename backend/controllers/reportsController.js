/**
 * reportsController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads from obd_history and buses collections to generate:
 *   GET /api/reports/monthly/:busId?month=0-11&year=YYYY  — monthly aggregate
 *   GET /api/reports/history/:busId?from=ISO&to=ISO&limit=100&offset=0 — raw records
 *   GET /api/reports/export/csv/:busId?month=0-11&year=YYYY — CSV download
 *   GET /api/reports/fleet-summary — fleet-wide stats
 *
 * Parameters stored per record (parsed from JSON — 20+ OBD-II PIDs):
 *   speed, rpm, fuelLevel, coolantTemp, batteryVoltage, engineLoad,
 *   throttlePosition, massAirFlow, intakeAirTemp, fuelPressure,
 *   shortTermFuelTrim, longTermFuelTrim, engineRuntime,
 *   distanceSinceCodesCleared, oxygenSensors, odometer, ignition,
 *   engineTemperature, oilTemp, oilPressure, timingAdvance,
 *   barometricPressure, catalystTemp, manifoldPressure, lat, lng
 *   + any additional dynamic parameters
 */

import { db, DB_ID, COLL, Query } from '../config/appwrite.js';
import { getDemoReports, buildDemoMonthlyReport, getDemoBuses } from '../services/demoDataService.js';

/* ── helpers ─────────────────────────────────────────────────────────────── */

const safeNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Parses ALL OBD parameters from a telemetry record.
 * Handles 20+ known PIDs and preserves any additional dynamic fields.
 */
const parseParams = (doc) => {
  try {
    const p = typeof doc.parameters === 'string' ? JSON.parse(doc.parameters) : doc.parameters || {};
    const fc = typeof doc.faultCodes === 'string' ? JSON.parse(doc.faultCodes) : doc.faultCodes || [];

    // Core parameters (always extracted)
    const result = {
      speed:                     safeNum(p.speed),
      rpm:                       safeNum(p.rpm),
      fuelLevel:                 safeNum(p.fuelLevel),
      coolantTemp:               safeNum(p.coolantTemp),
      batteryVoltage:            safeNum(p.batteryVoltage),
      engineLoad:                safeNum(p.engineLoad),
      ignition:                  p.ignition ?? null,
      odometer:                  safeNum(p.odometer),
      lat:                       safeNum(p.lat),
      lng:                       safeNum(p.lng),
      // Extended OBD-II PIDs
      throttlePosition:          safeNum(p.throttlePosition),
      massAirFlow:               safeNum(p.massAirFlow),
      intakeAirTemp:             safeNum(p.intakeAirTemp),
      fuelPressure:              safeNum(p.fuelPressure),
      shortTermFuelTrim:         safeNum(p.shortTermFuelTrim),
      longTermFuelTrim:          safeNum(p.longTermFuelTrim),
      engineRuntime:             safeNum(p.engineRuntime),
      distanceSinceCodesCleared: safeNum(p.distanceSinceCodesCleared),
      oxygenSensors:             safeNum(p.oxygenSensors),
      engineTemperature:         safeNum(p.engineTemperature),
      oilTemp:                   safeNum(p.oilTemp),
      oilPressure:               safeNum(p.oilPressure),
      timingAdvance:             safeNum(p.timingAdvance),
      barometricPressure:        safeNum(p.barometricPressure),
      catalystTemp:              safeNum(p.catalystTemp),
      manifoldPressure:          safeNum(p.manifoldPressure),
      faultCodes:                Array.isArray(fc) ? fc : [],
    };

    // Preserve any dynamic/unknown parameters
    const knownKeys = new Set(Object.keys(result));
    knownKeys.add('faultCodes');
    for (const [key, value] of Object.entries(p)) {
      if (!knownKeys.has(key)) {
        result[key] = typeof value === 'number' ? safeNum(value) : value;
      }
    }

    return result;
  } catch {
    return { speed:null, rpm:null, fuelLevel:null, coolantTemp:null, batteryVoltage:null, engineLoad:null, ignition:null, odometer:null, lat:null, lng:null, throttlePosition:null, massAirFlow:null, intakeAirTemp:null, fuelPressure:null, shortTermFuelTrim:null, longTermFuelTrim:null, engineRuntime:null, distanceSinceCodesCleared:null, oxygenSensors:null, engineTemperature:null, oilTemp:null, oilPressure:null, timingAdvance:null, barometricPressure:null, catalystTemp:null, manifoldPressure:null, faultCodes:[] };
  }
};

/**
 * Fetch ALL obd_history docs for a bus in [startISO, endISO).
 * Paginates through Appwrite (max 100 per request) up to maxPages.
 */
const fetchHistory = async (busId, startISO, endISO, maxPages = 20) => {
  const records = [];
  let lastId    = null;
  let page      = 0;

  while (page < maxPages) {
    const queries = [
      Query.equal('busId', busId),
      Query.greaterThanEqual('timestamp', startISO),
      Query.lessThan('timestamp', endISO),
      Query.orderAsc('timestamp'),
      Query.limit(100),
    ];
    if (lastId) queries.push(Query.cursorAfter(lastId));

    const result = await db.listDocuments(DB_ID, COLL.OBD_HISTORY, queries);
    records.push(...result.documents);

    if (result.documents.length < 100) break;   // last page
    lastId = result.documents.at(-1).$id;
    page++;
  }
  return records;
};

/** Build day key → aggregated bucket */
const groupByDay = (records) => {
  const days = {};
  for (const doc of records) {
    const p    = parseParams(doc);
    const date = new Date(doc.timestamp);
    const day  = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    if (!days[day]) days[day] = { readings: [], faultCount: 0, odometers: [], lats: [], lngs: [] };
    days[day].readings.push(p);
    days[day].faultCount += p.faultCodes.length;
    if (p.odometer != null) days[day].odometers.push(p.odometer);
    if (p.lat != null)      days[day].lats.push(p.lat);
    if (p.lng != null)      days[day].lngs.push(p.lng);
  }
  return days;
};

const avg = (arr, field) => {
  const vals = arr.map(r => r[field]).filter(v => v != null);
  if (!vals.length) return 0;
  return +(vals.reduce((s,v) => s+v, 0) / vals.length).toFixed(1);
};

const last = (arr, field) => {
  const vals = arr.map(r => r[field]).filter(v => v != null);
  return vals.length ? vals.at(-1) : 0;
};

/* ── GET /api/reports/monthly/:busId ─────────────────────────────────────── */
export const getMonthlyReport = async (req, res) => {
  try {
    const { busId } = req.params;
    const month     = parseInt(req.query.month ?? new Date().getMonth(), 10);
    const year      = parseInt(req.query.year  ?? new Date().getFullYear(), 10);

    // Demo mode: generate synthetic monthly report for this bus
    if (req.isDemo || busId.startsWith('BUS-')) {
      const report = buildDemoMonthlyReport(busId, month, year);
      return res.json({ success: true, report });
    }

    // Build ISO range for the month
    const startDate  = new Date(year, month, 1);
    const endDate    = new Date(year, month + 1, 1);
    const startISO   = startDate.toISOString();
    const endISO     = endDate.toISOString();

    const records    = await fetchHistory(busId, startISO, endISO);
    const days       = groupByDay(records);

    const daily = Object.entries(days)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([dayKey, d]) => {
        const dayNum    = parseInt(dayKey.split('-')[2], 10);
        const odomStart = d.odometers[0]  || 0;
        const odomEnd   = d.odometers.at(-1) || 0;
        const distance  = Math.max(0, +(odomEnd - odomStart).toFixed(1));
        return {
          day:            dayNum,
          date:           dayKey,
          readings:       d.readings.length,
          avgSpeed:       avg(d.readings, 'speed'),
          maxSpeed:       +(Math.max(0, ...d.readings.map(r=>r.speed??0).filter(v=>v!=null))).toFixed(1),
          avgRpm:         avg(d.readings, 'rpm'),
          avgFuelLevel:   avg(d.readings, 'fuelLevel'),
          avgCoolantTemp: avg(d.readings, 'coolantTemp'),
          avgBattery:     avg(d.readings, 'batteryVoltage'),
          avgEngineLoad:  avg(d.readings, 'engineLoad'),
          lastOdometer:   last(d.readings, 'odometer'),
          distance,
          faults:         d.faultCount,
          // Extended OBD-II PID averages
          avgThrottlePosition:   avg(d.readings, 'throttlePosition'),
          avgMassAirFlow:        avg(d.readings, 'massAirFlow'),
          avgIntakeAirTemp:      avg(d.readings, 'intakeAirTemp'),
          avgFuelPressure:       avg(d.readings, 'fuelPressure'),
          avgShortTermFuelTrim:  avg(d.readings, 'shortTermFuelTrim'),
          avgLongTermFuelTrim:   avg(d.readings, 'longTermFuelTrim'),
          avgOilTemp:            avg(d.readings, 'oilTemp'),
          avgOilPressure:        avg(d.readings, 'oilPressure'),
          avgTimingAdvance:      avg(d.readings, 'timingAdvance'),
          avgBarometricPressure: avg(d.readings, 'barometricPressure'),
          avgCatalystTemp:       avg(d.readings, 'catalystTemp'),
          avgManifoldPressure:   avg(d.readings, 'manifoldPressure'),
          // legacy aliases for existing chart keys
          fuelUsed:       avg(d.readings, 'fuelLevel'),    // proxy (actual burn rate needs odometer delta)
          idleTime:       avg(d.readings, 'engineLoad'),   // engine load proxy for idle metric
          alerts:         d.faultCount,
        };
      });

    const allReadings = records.map(parseParams);
    const totalOdomStart = allReadings.find(r => r.odometer != null)?.odometer || 0;
    const totalOdomEnd   = [...allReadings].reverse().find(r => r.odometer != null)?.odometer || 0;

    const summary = {
      month,
      year,
      busId,
      recordCount:    records.length,
      totalDistance:  +(Math.max(0, totalOdomEnd - totalOdomStart)).toFixed(1),
      avgSpeed:       avg(allReadings, 'speed'),
      maxSpeed:       +(Math.max(0, ...allReadings.map(r=>r.speed??0).filter(v=>v!=null), 0)).toFixed(1),
      avgRpm:         avg(allReadings, 'rpm'),
      avgFuelLevel:   avg(allReadings, 'fuelLevel'),
      avgCoolantTemp: avg(allReadings, 'coolantTemp'),
      avgBattery:     avg(allReadings, 'batteryVoltage'),
      avgEngineLoad:  avg(allReadings, 'engineLoad'),
      // Extended OBD-II PID summary averages
      avgThrottlePosition:   avg(allReadings, 'throttlePosition'),
      avgMassAirFlow:        avg(allReadings, 'massAirFlow'),
      avgIntakeAirTemp:      avg(allReadings, 'intakeAirTemp'),
      avgFuelPressure:       avg(allReadings, 'fuelPressure'),
      avgShortTermFuelTrim:  avg(allReadings, 'shortTermFuelTrim'),
      avgLongTermFuelTrim:   avg(allReadings, 'longTermFuelTrim'),
      avgOilTemp:            avg(allReadings, 'oilTemp'),
      avgOilPressure:        avg(allReadings, 'oilPressure'),
      avgTimingAdvance:      avg(allReadings, 'timingAdvance'),
      avgBarometricPressure: avg(allReadings, 'barometricPressure'),
      avgCatalystTemp:       avg(allReadings, 'catalystTemp'),
      avgManifoldPressure:   avg(allReadings, 'manifoldPressure'),
      totalFaults:    allReadings.reduce((s, r) => s + r.faultCodes.length, 0),
      activeDays:     Object.keys(days).length,
      // legacy aliases used by the existing download function
      totalFuel:      avg(allReadings, 'fuelLevel'),
      avgIdle:        avg(allReadings, 'engineLoad'),
      alerts:         allReadings.reduce((s, r) => s + r.faultCodes.length, 0),
    };

    res.json({ success: true, report: { month, year, busId, summary, daily } });
  } catch (err) {
    console.error('Monthly report error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ── GET /api/reports/history/:busId ─────────────────────────────────────── */
export const getHistory = async (req, res) => {
  try {
    const { busId }  = req.params;

    // Demo mode: synthesise raw OBD records from live demo bus state
    if (req.isDemo || busId.startsWith('BUS-')) {
      const { buses } = getDemoBuses(false);
      const bus = buses.find(b => b.id === busId) || buses[0];
      if (!bus) return res.json({ success: true, records: [], total: 0 });

      const limit  = Math.min(parseInt(req.query.limit  || 100, 10), 100);
      const snap   = bus.obd?.parameters || {};
      // Generate synthetic history records spaced 3 min apart with all 20+ PIDs
      const records = Array.from({ length: limit }, (_, i) => {
        const ts = new Date(Date.now() - i * 180000).toISOString();
        const jitter = (f) => f + (Math.random() - 0.5) * f * 0.05;
        return {
          id:              `${busId}-hist-${i}`,
          busId,
          timestamp:       ts,
          // Core PIDs
          speed:           parseFloat((jitter(snap.speed           || 38)).toFixed(1)),
          rpm:             Math.round(jitter(snap.rpm               || 1400)),
          fuelLevel:       parseFloat((jitter(snap.fuelLevel        || 65)).toFixed(1)),
          coolantTemp:     parseFloat((jitter(snap.coolantTemp      || 82)).toFixed(1)),
          batteryVoltage:  parseFloat((jitter(snap.batteryVoltage   || 13.2)).toFixed(2)),
          engineLoad:      parseFloat((jitter(snap.engineLoad       || 45)).toFixed(1)),
          ignition:        true,
          odometer:        Math.round((snap.odometer || 22000) - i * 0.7),
          // Extended PIDs
          throttlePosition:          parseFloat((jitter(snap.throttlePosition    || 35)).toFixed(1)),
          massAirFlow:               parseFloat((jitter(snap.massAirFlow         || 12)).toFixed(1)),
          intakeAirTemp:             parseFloat((jitter(snap.intakeAirTemp        || 30)).toFixed(1)),
          fuelPressure:              parseFloat((jitter(snap.fuelPressure         || 48)).toFixed(1)),
          shortTermFuelTrim:         parseFloat((jitter(snap.shortTermFuelTrim    || 2)).toFixed(1)),
          longTermFuelTrim:          parseFloat((jitter(snap.longTermFuelTrim     || 1)).toFixed(1)),
          engineRuntime:             Math.round(jitter(snap.engineRuntime || 7200)),
          distanceSinceCodesCleared: parseFloat((jitter(snap.distanceSinceCodesCleared || 180)).toFixed(1)),
          oxygenSensors:             parseFloat((jitter(snap.oxygenSensors        || 0.45)).toFixed(3)),
          engineTemperature:         parseFloat((jitter(snap.engineTemperature     || 85)).toFixed(1)),
          oilTemp:                   parseFloat((jitter(snap.oilTemp              || 88)).toFixed(1)),
          oilPressure:               parseFloat((jitter(snap.oilPressure          || 45)).toFixed(1)),
          timingAdvance:             parseFloat((jitter(snap.timingAdvance         || 12)).toFixed(1)),
          barometricPressure:        parseFloat((jitter(snap.barometricPressure    || 96)).toFixed(1)),
          catalystTemp:              parseFloat((jitter(snap.catalystTemp          || 420)).toFixed(1)),
          manifoldPressure:          parseFloat((jitter(snap.manifoldPressure      || 60)).toFixed(1)),
          // Location
          lat:             bus.location?.lat  ? bus.location.lat  + (Math.random() - 0.5) * 0.001 : null,
          lng:             bus.location?.lng  ? bus.location.lng  + (Math.random() - 0.5) * 0.001 : null,
          faultCodes:      i === 0 ? (bus.obd?.faultCodes || []).map(f => f.code || f) : [],
        };
      });
      return res.json({ success: true, records, total: records.length, limit, offset: 0 });
    }
    const limit      = Math.min(parseInt(req.query.limit  || 100, 10), 100);
    const offset     = parseInt(req.query.offset || 0, 10);
    const from       = req.query.from || new Date(Date.now() - 7*24*60*60*1000).toISOString();
    const to         = req.query.to   || new Date().toISOString();

    const queries = [
      Query.equal('busId', busId),
      Query.greaterThanEqual('timestamp', from),
      Query.lessThan('timestamp', to),
      Query.orderDesc('timestamp'),
      Query.limit(limit),
      Query.offset(offset),
    ];

    const result  = await db.listDocuments(DB_ID, COLL.OBD_HISTORY, queries);
    const records = result.documents.map(doc => ({
      id:        doc.$id,
      busId:     doc.busId,
      timestamp: doc.timestamp,
      ...parseParams(doc),
    }));

    res.json({ success: true, records, total: result.total, limit, offset });
  } catch (err) {
    console.error('History error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ── GET /api/reports/export/csv/:busId → CSV download ───────────────────── */
export const exportCSV = async (req, res) => {
  try {
    const { busId }  = req.params;
    const month      = parseInt(req.query.month ?? new Date().getMonth(), 10);
    const year       = parseInt(req.query.year  ?? new Date().getFullYear(), 10);
    const MONTHS_ARR = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    // Demo mode: generate CSV from demo monthly report
    if (req.isDemo || busId.startsWith('BUS-')) {
      const report = buildDemoMonthlyReport(busId, month, year);
      const header = 'busId,date,readings,avgSpeed_kmh,maxSpeed_kmh,avgRpm,avgFuelLevel_%,avgCoolantTemp_C,avgBattery_V,avgEngineLoad_%,distance_km,faults\n';
      const rows   = (report?.daily || []).map(d =>
        [busId, d.date, d.readings, d.avgSpeed, d.maxSpeed, d.avgRpm, d.avgFuelLevel,
         d.avgCoolantTemp, d.avgBattery, d.avgEngineLoad, d.distance, d.faults].join(',')
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${busId}-${MONTHS_ARR[month]}-${year}-demo.csv"`);
      return res.send(header + rows);
    }

    const startISO   = new Date(year, month, 1).toISOString();
    const endISO     = new Date(year, month + 1, 1).toISOString();

    const records    = await fetchHistory(busId, startISO, endISO, 50); // up to 5000 records

    const header = 'busId,timestamp,speed_kmh,rpm,fuelLevel_%,coolantTemp_C,batteryVoltage_V,engineLoad_%,ignition,odometer_km,lat,lng,faultCodes\n';
    const rows   = records.map(doc => {
      const p = parseParams(doc);
      return [
        doc.busId,
        doc.timestamp,
        p.speed         ?? '',
        p.rpm           ?? '',
        p.fuelLevel     ?? '',
        p.coolantTemp   ?? '',
        p.batteryVoltage ?? '',
        p.engineLoad    ?? '',
        p.ignition      ?? '',
        p.odometer      ?? '',
        p.lat           ?? '',
        p.lng           ?? '',
        `"${p.faultCodes.join(';')}"`,
      ].join(',');
    }).join('\n');

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${busId}-${MONTHS[month]}-${year}.csv"`);
    res.send(header + rows);
  } catch (err) {
    console.error('CSV export error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ── GET /api/reports/fleet-summary ──────────────────────────────────────── */
export const getFleetSummary = async (req, res) => {
  try {
    if (req.isDemo) {
      const { buses } = getDemoBuses(false);
      const active    = buses.filter(b => b.status === 'active').length;
      return res.json({ success: true, summary: { total: buses.length, active, inactive: buses.length - active, todayReadings: buses.length * 48, generatedAt: new Date().toISOString() } });
    }

    const buses   = await db.listDocuments(DB_ID, COLL.BUSES, [Query.limit(100)]);
    const active  = buses.documents.filter(b => b.status === 'active').length;
    const today   = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    // Count today's OBD records
    const todayRecs = await db.listDocuments(DB_ID, COLL.OBD_HISTORY, [
      Query.greaterThanEqual('timestamp', todayStart),
      Query.limit(1),
    ]);

    res.json({
      success: true,
      summary: {
        total:          buses.total,
        active,
        inactive:       buses.total - active,
        todayReadings:  todayRecs.total,
        generatedAt:    new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Fleet summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
