// OBD simulation interval — 3 seconds for live feel
const REFRESH_MS = 3000;

const DEMO_ROUTES = ['North Campus', 'South Campus', 'Hostel Loop', 'City Center'];
const DEMO_MODELS = ['Tata Starbus', 'Ashok Leyland Viking', 'BYD Electric'];
const DRIVER_NAMES = [
  'Arjun Sharma','Ravi Kumar','Pradeep Singh','Mohan Das','Suresh Nair',
  'Vijay Patel','Ramesh Yadav','Anil Gupta','Deepak Tiwari','Manoj Verma'
];

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const hashCode = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) { hash = (hash << 5) - hash + value.charCodeAt(i); hash |= 0; }
  return Math.abs(hash);
};

const stableBetween = (seed, min, max) => {
  const hash = hashCode(seed);
  return min + ((hash % 1000) / 1000) * (max - min);
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const createInitialObd = (seed) => ({
  // PID 0x05 — Engine Coolant Temperature
  engineTemperature: stableBetween(`${seed}-engineTemp`, 75, 98),
  // PID 0x42 — Control Module Voltage (Battery)
  batteryVoltage: stableBetween(`${seed}-batteryVoltage`, 12.4, 13.9),
  // PID 0x0C — Engine RPM
  rpm: stableBetween(`${seed}-rpm`, 900, 2400),
  // PID 0x2F — Fuel Tank Level Input
  fuelLevel: stableBetween(`${seed}-fuelLevel`, 45, 95),
  // PID 0x0D — Vehicle Speed
  speed: stableBetween(`${seed}-speed`, 10, 55),
  // PID 0x05 — Coolant Temperature (alias)
  coolantTemp: stableBetween(`${seed}-coolantTemp`, 70, 95),
  // PID 0x0F — Intake Air Temperature
  intakeAirTemp: stableBetween(`${seed}-intakeAirTemp`, 22, 38),
  // Oil Temperature (extended PID)
  oilTemp: stableBetween(`${seed}-oilTemp`, 75, 102),
  // Oil Pressure (extended PID)
  oilPressure: stableBetween(`${seed}-oilPressure`, 30, 65),
  // PID 0x11 — Throttle Position
  throttlePosition: stableBetween(`${seed}-throttlePosition`, 10, 65),
  // PID 0x0A — Fuel Pressure (gauge)
  fuelPressure: stableBetween(`${seed}-fuelPressure`, 35, 60),
  // PID 0x04 — Calculated Engine Load
  engineLoad: stableBetween(`${seed}-engineLoad`, 25, 70),
  // PID 0x10 — Mass Air Flow Rate
  massAirFlow: stableBetween(`${seed}-massAirFlow`, 4, 18),
  // PID 0x0E — Timing Advance
  timingAdvance: stableBetween(`${seed}-timingAdvance`, 0, 18),
  // PID 0x33 — Barometric Pressure
  barometricPressure: stableBetween(`${seed}-barometricPressure`, 88, 104),
  // PID 0x31 — Distance Since Codes Cleared
  distanceSinceCodesCleared: stableBetween(`${seed}-distance`, 50, 420),
  // PID 0x06 — Short Term Fuel Trim (Bank 1)
  shortTermFuelTrim: stableBetween(`${seed}-stft`, -10, 10),
  // PID 0x07 — Long Term Fuel Trim (Bank 1)
  longTermFuelTrim: stableBetween(`${seed}-ltft`, -8, 8),
  // PID 0x1F — Run Time Since Engine Start (seconds)
  engineRuntime: Math.round(stableBetween(`${seed}-runtime`, 300, 28800)),
  // PID 0x14-0x1B — Oxygen Sensor Voltage (Bank 1, Sensor 1)
  oxygenSensors: parseFloat(stableBetween(`${seed}-o2`, 0.1, 0.9).toFixed(3)),
  // Odometer (PID 0xA6 or derived)
  odometer: Math.round(stableBetween(`${seed}-odometer`, 12000, 90000)),
  // Ignition status
  ignition: true,
  // PID 0x3C — Catalyst Temperature
  catalystTemp: stableBetween(`${seed}-catalystTemp`, 250, 650),
  // PID 0x0B — Intake Manifold Pressure
  manifoldPressure: stableBetween(`${seed}-manifold`, 30, 100),
});

const updateObd = (obd) => ({
  ...obd,
  rpm: clamp(obd.rpm + randomBetween(-120, 140), 700, 3200),
  engineTemperature: clamp(obd.engineTemperature + randomBetween(-0.4, 0.7), 70, 115),
  engineLoad: clamp(obd.engineLoad + randomBetween(-3, 4), 10, 90),
  speed: clamp(obd.speed + randomBetween(-3, 3.5), 0, 90),
  fuelLevel: clamp(obd.fuelLevel - randomBetween(0.01, 0.05), 5, 100),
  batteryVoltage: clamp(obd.batteryVoltage + randomBetween(-0.06, 0.06), 11.5, 14.5),
  coolantTemp: clamp(obd.coolantTemp + randomBetween(-0.3, 0.4), 65, 108),
  intakeAirTemp: clamp(obd.intakeAirTemp + randomBetween(-0.4, 0.5), 18, 50),
  oilTemp: clamp(obd.oilTemp + randomBetween(-0.4, 0.6), 70, 115),
  oilPressure: clamp(obd.oilPressure + randomBetween(-1.5, 1.5), 20, 85),
  throttlePosition: clamp(obd.throttlePosition + randomBetween(-2.5, 2.5), 5, 90),
  fuelPressure: clamp(obd.fuelPressure + randomBetween(-1.2, 1.2), 28, 75),
  massAirFlow: clamp(obd.massAirFlow + randomBetween(-1.2, 1.2), 2, 32),
  timingAdvance: clamp(obd.timingAdvance + randomBetween(-1.5, 1.5), -5, 28),
  barometricPressure: clamp(obd.barometricPressure + randomBetween(-0.6, 0.6), 80, 110),
  distanceSinceCodesCleared: clamp(obd.distanceSinceCodesCleared + randomBetween(0.04, 0.25), 0, 999),
  // New parameters with realistic jitter
  shortTermFuelTrim: clamp((obd.shortTermFuelTrim || 0) + randomBetween(-1.5, 1.5), -25, 25),
  longTermFuelTrim: clamp((obd.longTermFuelTrim || 0) + randomBetween(-0.3, 0.3), -20, 20),
  engineRuntime: (obd.engineRuntime || 0) + 3,  // +3 seconds per tick
  oxygenSensors: clamp((obd.oxygenSensors || 0.45) + randomBetween(-0.05, 0.05), 0.05, 1.1),
  odometer: (obd.odometer || 22000) + randomBetween(0.01, 0.08),
  ignition: true,
  catalystTemp: clamp((obd.catalystTemp || 400) + randomBetween(-8, 10), 200, 800),
  manifoldPressure: clamp((obd.manifoldPressure || 60) + randomBetween(-3, 3), 20, 105),
});

const deriveFaultCodes = (obd) => {
  const f = [];
  if (obd.engineTemperature > 108) f.push({ code: 'P0217', desc: 'Engine Overtemperature Condition' });
  if (obd.coolantTemp > 106) f.push({ code: 'P0128', desc: 'Coolant Thermostat Below Regulating Temp' });
  if (obd.batteryVoltage < 11.8) f.push({ code: 'P0562', desc: 'System Voltage Low' });
  if (obd.fuelLevel < 12) f.push({ code: 'P0463', desc: 'Fuel Level Sensor High Input' });
  if (obd.oilPressure < 22) f.push({ code: 'P0520', desc: 'Engine Oil Pressure Sensor Circuit' });
  if (obd.rpm > 3100) f.push({ code: 'P0219', desc: 'Engine Over Speed Condition' });
  return f;
};

const createFeatures = (busId) => {
  const s = busId;
  return {
    overview: {
      etaMinutes: Math.round(stableBetween(`${s}-eta`, 4, 28)),
      utilizationPct: Math.round(stableBetween(`${s}-utilization`, 68, 96))
    },
    trips: Array.from({ length: 6 }, (_, i) => ({
      id: `${busId}-TRIP-${i + 1}`,
      start: ['Main Gate','Campus Center','Hostel Block A','Library','Canteen'][i % 5],
      end: DEMO_ROUTES[i % DEMO_ROUTES.length],
      distance: Math.round(stableBetween(`${s}-trip-${i}`, 4, 32)),
      duration: Math.round(stableBetween(`${s}-duration-${i}`, 18, 75)),
      avgSpeed: Math.round(stableBetween(`${s}-tripSpeed-${i}`, 22, 58)),
      fuelUsed: parseFloat(stableBetween(`${s}-tripFuel-${i}`, 1.5, 8.5).toFixed(1)),
      status: i === 0 ? 'live' : 'completed',
      date: new Date(Date.now() - i * 7200000).toLocaleDateString('en-IN')
    })),
    maintenance: {
      nextServiceKm: Math.round(stableBetween(`${s}-service`, 300, 2800)),
      lastServiceDate: new Date(Date.now() - stableBetween(`${s}-last`, 10, 60) * 86400000).toLocaleDateString('en-IN'),
      downtimeHours: Math.round(stableBetween(`${s}-downtime`, 0, 16)),
      openIssues: Math.round(stableBetween(`${s}-issues`, 0, 2)) > 0
        ? ['Brake pad wear','Tyre pressure check','AC filter cleaning'].slice(0, Math.round(stableBetween(`${s}-issues`, 1, 2)))
        : []
    },
    driverBehavior: {
      score: Math.round(stableBetween(`${s}-score`, 62, 97)),
      overspeedEvents: Math.round(stableBetween(`${s}-overspeed`, 0, 8)),
      harshBraking: Math.round(stableBetween(`${s}-brake`, 0, 12)),
      idleTime: Math.round(stableBetween(`${s}-idle`, 3, 38)),
      harshAcceleration: Math.round(stableBetween(`${s}-accel`, 0, 6)),
      sharpTurns: Math.round(stableBetween(`${s}-turns`, 0, 5))
    }
  };
};

const state = { buses: [], updatedAt: null, tickCount: 0 };
let intervalId = null;
let broadcastFn = null;

const initializeBuses = () => {
  state.buses = Array.from({ length: 10 }, (_, i) => {
    const busId = `BUS-${String(i + 1).padStart(3, '0')}`;
    const seed = busId;
    const obdParameters = createInitialObd(seed);
    const faultCodes = deriveFaultCodes(obdParameters);
    return {
      id: busId,
      registrationNumber: `DL-1${i}C-${1000 + i}`,
      busName: `Campus Shuttle ${i + 1}`,
      driverId: `DRV-${String(i + 1).padStart(3, '0')}`,
      driverName: DRIVER_NAMES[i],
      driverPhone: `+91 98${String(7600 + i).padStart(6, '0')}`,
      status: 'active',
      route: DEMO_ROUTES[i % DEMO_ROUTES.length],
      model: DEMO_MODELS[i % DEMO_MODELS.length],
      year: 2018 + (i % 5),
      capacity: 40 + (i % 3) * 8,
      mileage: Math.floor(stableBetween(`${seed}-mileage`, 12000, 90000)),
      location: {
        lat: 28.70 + stableBetween(`${seed}-lat`, -0.06, 0.06),
        lng: 77.10 + stableBetween(`${seed}-lng`, -0.06, 0.06)
      },
      obd: { parameters: obdParameters, faultCodes },
      features: createFeatures(busId),
      obdTrend: [],
      alerts: faultCodes.map(f => `${f.code}: ${f.desc}`)
    };
  });
  state.updatedAt = new Date().toISOString();
  state.tickCount = 0;
};

const updateBuses = () => {
  state.tickCount += 1;
  state.buses = state.buses.map((bus) => {
    const updatedObd = updateObd(bus.obd.parameters);
    const faultCodes = deriveFaultCodes(updatedObd);
    const angle = ((state.tickCount * 0.018) + hashCode(bus.id) * 0.000001) % (2 * Math.PI);
    const location = {
      lat: clamp(bus.location.lat + Math.sin(angle) * 0.0004 + randomBetween(-0.0001, 0.0001), 28.60, 28.82),
      lng: clamp(bus.location.lng + Math.cos(angle) * 0.0004 + randomBetween(-0.0001, 0.0001), 77.00, 77.24)
    };
    const trendEntry = {
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      engineTemp: Math.round(updatedObd.engineTemperature),
      rpm: Math.round(updatedObd.rpm),
      fuelLevel: parseFloat(updatedObd.fuelLevel.toFixed(1)),
      speed: Math.round(updatedObd.speed),
      engineLoad: Math.round(updatedObd.engineLoad),
      batteryVoltage: parseFloat(updatedObd.batteryVoltage.toFixed(2))
    };
    const obdTrend = [...(bus.obdTrend || []), trendEntry].slice(-24);
    const roll = randomBetween(0, 1);
    const status = roll > 0.988 ? 'maintenance' : roll < 0.004 ? 'offline' : 'active';
    const alerts = [
      ...faultCodes.map(f => `${f.code}: ${f.desc}`),
      ...(updatedObd.speed > 75 ? ['Overspeed Detected'] : []),
      ...(updatedObd.fuelLevel < 15 ? ['Low Fuel Warning'] : []),
      ...(updatedObd.engineTemperature > 108 ? ['Engine Overheating'] : [])
    ];
    return {
      ...bus, status, location,
      obd: { parameters: updatedObd, faultCodes },
      obdTrend, alerts,
      features: {
        ...bus.features,
        overview: {
          ...bus.features.overview,
          etaMinutes: Math.max(1, bus.features.overview.etaMinutes + Math.round(randomBetween(-1, 1)))
        }
      },
      lastUpdated: new Date().toISOString()
    };
  });
  state.updatedAt = new Date().toISOString();
};

const ensureDemoRunning = (broadcast) => {
  if (state.buses.length === 0) initializeBuses();
  if (broadcast && !broadcastFn) broadcastFn = broadcast;
  if (!intervalId) {
    intervalId = setInterval(() => {
      updateBuses();
      if (broadcastFn) {
        try { broadcastFn.emit('demo:update', { updatedAt: state.updatedAt, buses: state.buses }); }
        catch (_) {}
      }
    }, REFRESH_MS);
  }
};

export const getDemoBuses = (broadcast) => {
  ensureDemoRunning(broadcast);
  return { updatedAt: state.updatedAt, buses: state.buses };
};

export const getDemoBusById = (busId, broadcast) => {
  ensureDemoRunning(broadcast);
  return state.buses.find((b) => b.id === busId) || null;
};

export const getDemoDrivers = (broadcast) => {
  ensureDemoRunning(broadcast);
  return {
    updatedAt: state.updatedAt,
    drivers: state.buses.map((bus, i) => ({
      id: bus.driverId,
      name: bus.driverName,
      phone: bus.driverPhone,
      licenseNumber: `DL${i + 1}LIC${String(1000 + i)}`,
      email: `${bus.driverName.toLowerCase().replace(' ', '.')}@livefleet.demo`,
      status: 'active',
      assignedBus: bus.id,
      assignedBusName: bus.busName,
      route: bus.route,
      score: bus.features?.driverBehavior?.score || 0,
      overspeedEvents: bus.features?.driverBehavior?.overspeedEvents || 0,
      createdAt: new Date(Date.now() - stableBetween(`${bus.id}-dc`, 30, 420) * 86400000).toISOString()
    }))
  };
};

/**
 * buildDemoMonthlyReport — generates a realistic monthly OBD report for a demo bus.
 * Returns the same shape as the real reportsController: { month, year, busId, summary, daily }
 */
export const buildDemoMonthlyReport = (busId, month, year) => {
  ensureDemoRunning(false);
  const bus = state.buses.find(b => b.id === busId) || state.buses[0];
  if (!bus) return null;

  const snap   = bus.obd?.parameters || {};
  const seed   = `${busId}-${month}-${year}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let runningOdometer = Math.round(stableBetween(`${seed}-odo-start`, 12000, 45000));

  const daily = Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    const ds       = `${seed}-d${day}`;
    const dayStr   = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const readings = Math.round(stableBetween(`${ds}-readings`, 12, 48));
    const dist     = parseFloat(stableBetween(`${ds}-dist`, 35, 140).toFixed(1));
    runningOdometer += dist;
    const faults   = Math.round(stableBetween(`${ds}-faults`, 0, 2));
    return {
      day,
      date:           dayStr,
      readings,
      avgSpeed:       parseFloat(stableBetween(`${ds}-speed`, 28, 62).toFixed(1)),
      maxSpeed:       parseFloat(stableBetween(`${ds}-maxspd`, 55, 85).toFixed(1)),
      avgRpm:         Math.round(stableBetween(`${ds}-rpm`, 900, 2200)),
      avgFuelLevel:   parseFloat(stableBetween(`${ds}-fuel`, 42, 88).toFixed(1)),
      avgCoolantTemp: parseFloat(stableBetween(`${ds}-coolant`, 72, 95).toFixed(1)),
      avgBattery:     parseFloat(stableBetween(`${ds}-batt`, 12.4, 13.9).toFixed(2)),
      avgEngineLoad:  parseFloat(stableBetween(`${ds}-load`, 28, 70).toFixed(1)),
      lastOdometer:   Math.round(runningOdometer),
      distance:       dist,
      faults,
      // Extended OBD-II PID averages
      avgThrottlePosition:   parseFloat(stableBetween(`${ds}-throttle`, 10, 75).toFixed(1)),
      avgMassAirFlow:        parseFloat(stableBetween(`${ds}-maf`, 3, 200).toFixed(1)),
      avgIntakeAirTemp:      parseFloat(stableBetween(`${ds}-iat`, 20, 50).toFixed(1)),
      avgFuelPressure:       Math.round(stableBetween(`${ds}-fpres`, 150, 450)),
      avgShortTermFuelTrim:  parseFloat(stableBetween(`${ds}-stft`, -8, 8).toFixed(1)),
      avgLongTermFuelTrim:   parseFloat(stableBetween(`${ds}-ltft`, -6, 6).toFixed(1)),
      avgOilTemp:            parseFloat(stableBetween(`${ds}-oilt`, 85, 115).toFixed(1)),
      avgOilPressure:        parseFloat(stableBetween(`${ds}-oilp`, 28, 60).toFixed(1)),
      avgTimingAdvance:      parseFloat(stableBetween(`${ds}-timing`, -5, 35).toFixed(1)),
      avgBarometricPressure: parseFloat(stableBetween(`${ds}-baro`, 95, 105).toFixed(1)),
      avgCatalystTemp:       parseFloat(stableBetween(`${ds}-cat`, 280, 600).toFixed(1)),
      avgManifoldPressure:   Math.round(stableBetween(`${ds}-map`, 30, 95)),
      fuelUsed:       parseFloat(stableBetween(`${ds}-fuelused`, 8, 22).toFixed(1)),
      idleTime:       Math.round(stableBetween(`${ds}-idle`, 5, 35)),
      alerts:         faults,
    };
  });

  const allSpeeds     = daily.map(d => d.avgSpeed);
  const allRpms       = daily.map(d => d.avgRpm);
  const allFuel       = daily.map(d => d.avgFuelLevel);
  const allCoolant    = daily.map(d => d.avgCoolantTemp);
  const allBatt       = daily.map(d => d.avgBattery);
  const allLoad       = daily.map(d => d.avgEngineLoad);
  const totalFaults   = daily.reduce((s, d) => s + d.faults, 0);
  const totalDist     = parseFloat(daily.reduce((s, d) => s + d.distance, 0).toFixed(1));
  const totalReadings = daily.reduce((s, d) => s + d.readings, 0);
  const meanOf        = (arr) => parseFloat((arr.reduce((s, v) => s + v, 0) / (arr.length || 1)).toFixed(1));

  const summary = {
    month,
    year,
    busId,
    recordCount:    totalReadings,
    totalDistance:  totalDist,
    avgSpeed:       meanOf(allSpeeds),
    maxSpeed:       parseFloat(Math.max(...daily.map(d => d.maxSpeed)).toFixed(1)),
    avgRpm:         Math.round(meanOf(allRpms)),
    avgFuelLevel:   meanOf(allFuel),
    avgCoolantTemp: meanOf(allCoolant),
    avgBattery:     parseFloat(meanOf(allBatt).toFixed(2)),
    avgEngineLoad:  meanOf(allLoad),
    totalFaults,
    activeDays:     daily.length,
    totalFuel:      meanOf(allFuel),
    avgIdle:        Math.round(meanOf(daily.map(d => d.idleTime))),
    alerts:         totalFaults,
  };

  return { month, year, busId, summary, daily };
};

export const getDemoReports = (broadcast) => {
  ensureDemoRunning(broadcast);
  return {
    updatedAt: state.updatedAt,
    reports: state.buses.map((bus) => {
      const snap = bus.obd?.parameters || {};
      const faults = bus.obd?.faultCodes || [];
      const ds = bus.features?.driverBehavior?.score || 80;
      const penalty =
        (snap.engineTemperature > 108 ? 15 : snap.engineTemperature > 100 ? 5 : 0) +
        (snap.fuelLevel < 12 ? 12 : snap.fuelLevel < 20 ? 5 : 0) +
        (faults.length * 8) + (ds < 70 ? 8 : 0);
      const score = Math.max(40, Math.min(99, Math.round(95 - penalty - randomBetween(0, 4))));
      const status = score >= 82 ? 'healthy' : score >= 68 ? 'warning' : 'critical';
      return {
        id: bus.id,
        registrationNumber: bus.registrationNumber,
        busName: bus.busName,
        driverName: bus.driverName,
        model: bus.model,
        route: bus.route,
        status, performanceScore: score,
        fuelUsage: parseFloat(stableBetween(`${bus.id}-fuelUsage`, 10, 22).toFixed(1)),
        averageSpeed: Math.round(snap.speed || stableBetween(`${bus.id}-avgSpeed`, 28, 62)),
        totalDistance: Math.round(stableBetween(`${bus.id}-totalDist`, 120, 680)),
        alerts: bus.alerts || [],
        faultCodes: faults,
        obdTrend: bus.obdTrend || [],
        obdSnapshot: snap,
        driverBehavior: bus.features?.driverBehavior || {}
      };
    })
  };
};
