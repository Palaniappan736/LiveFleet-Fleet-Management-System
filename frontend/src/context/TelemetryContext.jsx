/**
 * TelemetryContext — Live OBD telemetry store keyed by bus ID.
 *
 * Demo Mode  : Polls /api/demo/buses every 3 s.
 * Real Mode  : Polls /api/obd-live/all (MQTT in-memory cache) every 5 s.
 *              ONLY buses currently sending telemetry via MQTT are shown.
 *              Socket.IO pushes real-time updates between polls.
 *              Appwrite metadata is fetched once for bus name/route enrichment.
 *              NO demo data ever leaks into real mode.
 *
 * Shape: telemetry[busId] = { parameters, location, status, faultCodes, driverName }
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { demoAPI, obdLiveAPI, busAPI } from "../services/api";
import { useSystemMode } from "./SystemModeContext";

const DEMO_REFRESH_MS  = 3000;    // 3 s — responsive demo polling
const REAL_REFRESH_MS  = 5000;    // 5 s — check for new MQTT buses frequently
const SOCKET_URL       = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const TelemetryContext = createContext({
  telemetry: {}, buses: [], error: null, connected: false, loading: true,
});

export function TelemetryProvider({ children }) {
  const { isReal } = useSystemMode();
  const [telemetry, setTelemetry]   = useState({});
  const [buses,     setBuses]       = useState([]);
  const [error,     setError]       = useState(null);
  const [connected, setConnected]   = useState(false);   // Socket.IO connected?
  const [loading,   setLoading]     = useState(true);
  const socketRef       = useRef(null);
  const appwriteMetaRef = useRef({});   // cached Appwrite bus metadata for enrichment

  /* ── Helper: convert bus list to telemetry map ────────────────────── */
  const listToMap = (list) => {
    const map = {};
    for (const bus of list) {
      map[bus.id] = {
        parameters: bus.obd?.parameters || {},
        location:   bus.location,
        status:     bus.status,
        faultCodes: bus.obd?.faultCodes || [],
        driverName: bus.driverName,
      };
    }
    return map;
  };

  /* ── Helper: build a bus object from MQTT data + optional Appwrite meta ─ */
  const buildBusFromMqtt = (busId, mqttEntry) => {
    const meta   = appwriteMetaRef.current[busId];
    const params = mqttEntry?.parameters || {};
    const { lat, lng, ...obdParams } = params;
    return {
      id:                 busId,
      busName:            meta?.busName || busId,
      registrationNumber: meta?.registrationNumber || busId,
      route:              meta?.route || '',
      status:             'active',
      driverName:         meta?.driverName || '',
      capacity:           meta?.capacity || 50,
      etaMinutes:         meta?.etaMinutes || 0,
      model:              meta?.model || '',
      updatedAt:          mqttEntry?.timestamp || new Date().toISOString(),
      obd:                { parameters: obdParams, faultCodes: mqttEntry?.faultCodes || [] },
      location:           (lat != null && lng != null)
                            ? { lat, lng }
                            : meta?.location || null,
      features:           meta?.features || {},
    };
  };

  /* ── Clear stale data when mode switches ─────────────────────────── */
  useEffect(() => {
    setTelemetry({});
    setBuses([]);
    setError(null);
    setLoading(true);
    appwriteMetaRef.current = {};
  }, [isReal]);

  /* ── Demo Mode: simple polling ───────────────────────────────────── */
  useEffect(() => {
    if (isReal) return;

    const load = async () => {
      try {
        const res  = await demoAPI.getDemoBuses();
        const list = res.data?.buses || [];
        setBuses(list);
        setTelemetry(listToMap(list));
        setError(null);
      } catch { setError("Telemetry fetch failed"); }
      finally { setLoading(false); }
    };

    load();
    const id = setInterval(load, DEMO_REFRESH_MS);
    return () => clearInterval(id);
  }, [isReal]);

  /* ── Real Mode: MQTT-only buses + Socket.IO real-time updates ────── */
  useEffect(() => {
    if (!isReal) return;

    /* 1. Fetch Appwrite metadata ONCE for bus name/route enrichment */
    const fetchMeta = async () => {
      try {
        const res  = await busAPI.getAllBuses();
        const list = res.data?.buses || [];
        const meta = {};
        for (const b of list) meta[b.id] = b;
        appwriteMetaRef.current = meta;
      } catch { /* Appwrite unreachable — MQTT data is still enough */ }
    };
    fetchMeta();

    /* 2. Poll /api/obd-live/all — returns ONLY MQTT in-memory buses */
    const loadMqttBuses = async () => {
      try {
        const obdRes   = await obdLiveAPI.getAll();
        const mqttData = obdRes.data?.buses || {};
        const ids      = Object.keys(mqttData);

        if (ids.length === 0) {
          setBuses([]);
          setTelemetry({});
          setError(null);
          setLoading(false);
          return;
        }

        const busList = ids.map(busId => buildBusFromMqtt(busId, mqttData[busId]));
        setBuses(busList);
        setTelemetry(listToMap(busList));
        setError(null);
      } catch (e) {
        setError("Failed to load real bus data: " + e.message);
      } finally { setLoading(false); }
    };

    loadMqttBuses();
    const pollId = setInterval(loadMqttBuses, REAL_REFRESH_MS);

    /* 3. Socket.IO for instant MQTT updates (between polls) */
    const sock = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = sock;

    sock.on("connect",    () => setConnected(true));
    sock.on("disconnect", () => setConnected(false));

    /* obdUpdate: raw OBD parameter update from MQTT */
    sock.on("obdUpdate", ({ busId, parameters, faultCodes, timestamp }) => {
      if (!busId) return;
      setTelemetry((prev) => ({
        ...prev,
        [busId]: {
          ...prev[busId],
          parameters:  parameters || prev[busId]?.parameters || {},
          faultCodes:  faultCodes  || prev[busId]?.faultCodes || [],
          lastMqttAt:  timestamp,
        },
      }));
      // Ensure bus exists in bus list (new bus detected via Socket.IO)
      setBuses((prev) => {
        const exists = prev.find(b => b.id === busId);
        if (exists) {
          return prev.map(b => b.id === busId ? {
            ...b,
            obd: { parameters: parameters || b.obd?.parameters, faultCodes: faultCodes || b.obd?.faultCodes },
            updatedAt: timestamp,
          } : b);
        }
        return [...prev, buildBusFromMqtt(busId, { parameters, faultCodes, timestamp })];
      });
    });

    /* busUpdate: status/location update from MQTT */
    sock.on("busUpdate", ({ busId, obd, status, updatedAt, location }) => {
      if (!busId) return;
      setTelemetry((prev) => ({
        ...prev,
        [busId]: {
          ...prev[busId],
          parameters: obd?.parameters || prev[busId]?.parameters || {},
          faultCodes: obd?.faultCodes || prev[busId]?.faultCodes || [],
          status:     status || prev[busId]?.status,
          location:   location || prev[busId]?.location,
          lastMqttAt: updatedAt,
        },
      }));
      setBuses((prev) => {
        const exists = prev.find(b => b.id === busId);
        if (exists) {
          return prev.map(b => b.id === busId ? {
            ...b,
            status:   status || b.status,
            location: location || b.location,
            obd:      { parameters: obd?.parameters || b.obd?.parameters, faultCodes: obd?.faultCodes || b.obd?.faultCodes },
            updatedAt,
          } : b);
        }
        return [...prev, buildBusFromMqtt(busId, { parameters: obd?.parameters, faultCodes: obd?.faultCodes, timestamp: updatedAt })];
      });
    });

    /* faultAlert: DTC fault codes from MQTT */
    sock.on("faultAlert", ({ busId, faultCodes }) => {
      if (!busId) return;
      setTelemetry((prev) => ({
        ...prev,
        [busId]: { ...prev[busId], faultCodes },
      }));
    });

    return () => {
      clearInterval(pollId);
      sock.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [isReal]);

  return (
    <TelemetryContext.Provider value={{ telemetry, buses, error, connected, loading }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  return useContext(TelemetryContext);
}

export default TelemetryContext;

