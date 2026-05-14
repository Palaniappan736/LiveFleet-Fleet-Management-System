/**
 * busController.js  –  Appwrite-backed bus CRUD
 */
import { db, DB_ID, COLL, ID, Query, parseObd, parseLocation } from '../config/appwrite.js';
import { getDemoBuses, getDemoBusById } from '../services/demoDataService.js';
import { isDemoMode } from '../services/systemModeService.js';

/* ── helper: map Appwrite document → clean bus object ───────────────────── */
const mapBus = (doc) => ({
  id:                 doc.$id,
  busName:            doc.busName,
  registrationNumber: doc.registrationNumber,
  route:              doc.route,
  status:             doc.status,
  driverName:         doc.driverName,
  capacity:           doc.capacity,
  etaMinutes:         doc.etaMinutes,
  model:              doc.model,
  updatedAt:          doc.updatedAt,
  obd:                parseObd(doc),
  location:           parseLocation(doc),
});

/* ── GET /api/buses  ─────────────────────────────────────────────────────── */
export const GetAllBuses = async (req, res) => {
  try {
    if (isDemoMode() || req.isDemo) {
      const { buses } = getDemoBuses();
      return res.json({ buses });
    }
    const result = await db.listDocuments(DB_ID, COLL.BUSES, [Query.limit(100)]);
    res.json({ buses: result.documents.map(mapBus) });
  } catch (error) {
    console.error('Get buses error:', error);
    res.status(500).json({ error: error.message });
  }
};

/* ── GET /api/buses/:id  ─────────────────────────────────────────────────── */
export const GetBus = async (req, res) => {
  try {
    const { id } = req.params;
    if (isDemoMode() || req.isDemo) {
      const bus = getDemoBusById(id);
      if (!bus) return res.status(404).json({ error: 'Bus not found' });
      return res.json({ bus });
    }
    try {
      const doc = await db.getDocument(DB_ID, COLL.BUSES, id);
      res.json({ bus: mapBus(doc) });
    } catch (e) {
      if (e.code === 404) return res.status(404).json({ error: 'Bus not found' });
      throw e;
    }
  } catch (error) {
    console.error('Get bus error:', error);
    res.status(500).json({ error: error.message });
  }
};

/* ── POST /api/buses  ────────────────────────────────────────────────────── */
export const CreateBus = async (req, res) => {
  try {
    if (isDemoMode() || req.isDemo) return res.status(403).json({ error: 'Demo mode is read-only' });

    const {
      busName, registrationNumber, route, driverName,
      capacity = 50, etaMinutes = 0, model = '',
    } = req.body;

    const doc = await db.createDocument(DB_ID, COLL.BUSES, ID.unique(), {
      busName,
      registrationNumber,
      route,
      driverName,
      capacity,
      etaMinutes,
      model,
      status:    'inactive',
      obd:       JSON.stringify({}),
      location:  JSON.stringify({}),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({ success: true, message: 'Bus created successfully', busId: doc.$id });
  } catch (error) {
    console.error('Create bus error:', error);
    res.status(500).json({ error: error.message });
  }
};

/* ── PUT /api/buses/:id  ─────────────────────────────────────────────────── */
export const UpdateBus = async (req, res) => {
  try {
    if (isDemoMode() || req.isDemo) return res.status(403).json({ error: 'Demo mode is read-only' });

    const { id } = req.params;
    const { obd, location, ...rest } = req.body;

    const updateData = {
      ...rest,
      updatedAt: new Date().toISOString(),
    };
    if (obd      !== undefined) updateData.obd      = JSON.stringify(obd);
    if (location !== undefined) updateData.location = JSON.stringify(location);

    await db.updateDocument(DB_ID, COLL.BUSES, id, updateData);
    res.json({ success: true, message: 'Bus updated successfully' });
  } catch (error) {
    console.error('Update bus error:', error);
    res.status(500).json({ error: error.message });
  }
};

/* ── DELETE /api/buses/:id  ──────────────────────────────────────────────── */
export const DeleteBus = async (req, res) => {
  try {
    if (isDemoMode() || req.isDemo) return res.status(403).json({ error: 'Demo mode is read-only' });

    const { id } = req.params;
    await db.deleteDocument(DB_ID, COLL.BUSES, id);
    res.json({ success: true, message: 'Bus deleted successfully' });
  } catch (error) {
    console.error('Delete bus error:', error);
    res.status(500).json({ error: error.message });
  }
};

/* ── GET /api/buses/student/my-bus  ──────────────────────────────────────── */
export const GetStudentBus = async (req, res) => {
  try {
    if (isDemoMode() || req.isDemo) {
      const { buses } = getDemoBuses();
      return res.json({ bus: buses[0] || null });
    }

    // Look up the user profile to find assignedBus
    const userResults = await db.listDocuments(DB_ID, COLL.USERS, [
      Query.equal('userId', req.uid),
      Query.limit(1),
    ]);

    if (!userResults.total) return res.json({ bus: null });

    const userProfile = userResults.documents[0];
    if (!userProfile.assignedBus) return res.json({ bus: null });

    try {
      const busDoc = await db.getDocument(DB_ID, COLL.BUSES, userProfile.assignedBus);
      res.json({ bus: mapBus(busDoc) });
    } catch {
      res.json({ bus: null });
    }
  } catch (error) {
    console.error('Get student bus error:', error);
    res.status(500).json({ error: error.message });
  }
};
