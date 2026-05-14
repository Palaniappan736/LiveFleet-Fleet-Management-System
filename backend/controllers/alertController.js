/**
 * alertController.js  –  Appwrite edition
 */
import { db, DB_ID, COLL, ID, Query } from '../config/appwrite.js';

const ALERTS_COLL = 'alerts';

const mapAlert = (doc) => ({ id: doc.$id, busId: doc.busId, type: doc.type, message: doc.message, severity: doc.severity, read: doc.read, createdAt: doc.createdAt });

export const GetAlerts = async (req, res) => {
  try {
    const queries = [Query.orderDesc('createdAt'), Query.limit(100)];
    if (req.query.unread === 'true') queries.push(Query.equal('read', false));
    const result = await db.listDocuments(DB_ID, ALERTS_COLL, queries);
    res.json({ alerts: result.documents.map(mapAlert) });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const GetBusAlerts = async (req, res) => {
  try {
    const result = await db.listDocuments(DB_ID, ALERTS_COLL, [
      Query.equal('busId', req.params.busId),
      Query.orderDesc('createdAt'),
      Query.limit(50),
    ]);
    res.json({ alerts: result.documents.map(mapAlert) });
  } catch (error) {
    console.error('Get bus alerts error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const CreateAlert = async (req, res) => {
  try {
    const { busId, type, message, severity } = req.body;
    const doc = await db.createDocument(DB_ID, ALERTS_COLL, ID.unique(), {
      busId, type, message,
      severity: severity || 'medium',
      read: false,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, alertId: doc.$id });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const MarkAlertRead = async (req, res) => {
  try {
    await db.updateDocument(DB_ID, ALERTS_COLL, req.params.id, { read: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark alert read error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const DeleteAlert = async (req, res) => {
  try {
    await db.deleteDocument(DB_ID, ALERTS_COLL, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: error.message });
  }
};
