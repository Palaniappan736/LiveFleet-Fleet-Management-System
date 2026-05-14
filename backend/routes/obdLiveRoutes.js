import express from 'express';
import {
  getLatestObdData, getAllLatest, isConfigured, isConnected,
  getBusCount, getConnectedBuses,
  getMqttStatus, configureMqtt, disconnectMqtt,
} from '../services/mqttService.js';
import { getSystemMode, setSystemMode } from '../services/systemModeService.js';
import { verifyToken, verifyRole } from '../middleware/auth.js';
import { db, DB_ID, COLL, Query } from '../config/appwrite.js';
import { checkDbStatus } from '../controllers/authController.js';

const router = express.Router();

/* ══════════════════════════════════════════════════════════════════════════
   SYSTEM MODE ENDPOINTS
   ══════════════════════════════════════════════════════════════════════════ */

/** GET /api/obd-live/system/mode — current mode (demo/real) */
router.get('/system/mode', (req, res) => {
  res.json({ mode: getSystemMode() });
});

/** PUT /api/obd-live/system/mode — switch mode (manager only) */
router.put('/system/mode', verifyToken, verifyRole(['manager', 'admin']), (req, res) => {
  const { mode } = req.body;
  if (!mode || !['demo', 'real'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be "demo" or "real"' });
  }
  const ok = setSystemMode(mode);
  if (!ok) return res.status(403).json({ error: 'Mode is locked by server configuration (DEMO_ONLY=true)' });
  res.json({ success: true, mode: getSystemMode() });
});

/* ══════════════════════════════════════════════════════════════════════════
   MQTT CONNECTION MANAGEMENT — used by Settings page
   ══════════════════════════════════════════════════════════════════════════ */

/** GET /api/obd-live/mqtt/status — detailed MQTT connection status */
router.get('/mqtt/status', (req, res) => {
  res.json(getMqttStatus());
});

/** POST /api/obd-live/mqtt/connect — dynamically connect to an MQTT broker */
router.post('/mqtt/connect', verifyToken, verifyRole(['manager', 'admin']), (req, res) => {
  const { brokerUrl, username, password, topic } = req.body;
  if (!brokerUrl) return res.status(400).json({ error: 'brokerUrl is required' });

  const result = configureMqtt({ brokerUrl, username, password, topic });
  if (!result.success) return res.status(400).json(result);

  // Return status after a brief delay to allow connection attempt
  setTimeout(() => {
    res.json({ ...result, status: getMqttStatus() });
  }, 2000);
});

/** POST /api/obd-live/mqtt/disconnect — gracefully disconnect MQTT */
router.post('/mqtt/disconnect', verifyToken, verifyRole(['manager', 'admin']), (req, res) => {
  const result = disconnectMqtt();
  res.json({ ...result, status: getMqttStatus() });
});

/** GET /api/obd-live/db/status — test Appwrite database connectivity */
router.get('/db/status', checkDbStatus);

/* ══════════════════════════════════════════════════════════════════════════
   OBD LIVE DATA ENDPOINTS (original)
   ══════════════════════════════════════════════════════════════════════════ */

/** GET /api/obd-live/status — legacy MQTT status (kept for backward compat) */
router.get('/status', (req, res) => {
  res.json({
    configured:     isConfigured(),
    connected:      isConnected(),
    busCount:       getBusCount(),
    connectedBuses: getConnectedBuses(),
  });
});

/** GET /api/obd-live/all — all latest OBD data (in-memory cache) */
router.get('/all', (req, res) => {
  res.json({ buses: getAllLatest() });
});

/** GET /api/obd-live/:busId — latest OBD for one bus (in-memory) */
router.get('/:busId', (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'MQTT not configured', message: 'Connect to an MQTT broker from Settings' });
  }
  if (!isConnected()) {
    return res.status(503).json({ error: 'MQTT not connected', message: 'Broker connection lost — check Settings' });
  }

  const latest = getLatestObdData(req.params.busId);
  if (!latest) {
    return res.status(404).json({ error: 'No OBD data', message: 'No MQTT messages received for this bus yet' });
  }
  res.json(latest);
});

/** GET /api/obd-live/:busId/history — OBD history (Appwrite obd_history) */
router.get('/:busId/history', async (req, res) => {
  try {
    const { busId } = req.params;
    const limit     = Math.min(parseInt(req.query.limit || '100', 10), 500);

    const result = await db.listDocuments(DB_ID, COLL.OBD_HISTORY, [
      Query.equal('busId', busId),
      Query.orderDesc('timestamp'),
      Query.limit(limit),
    ]);

    const history = result.documents.map((doc) => ({
      id:         doc.$id,
      busId:      doc.busId,
      timestamp:  doc.timestamp,
      parameters: (() => { try { return JSON.parse(doc.parameters); } catch { return doc.parameters; } })(),
      faultCodes: (() => { try { return JSON.parse(doc.faultCodes); } catch { return []; } })(),
    }));

    res.json({ busId, count: history.length, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
