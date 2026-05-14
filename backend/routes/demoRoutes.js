import express from 'express';
import { getDemoBuses, getDemoBusById, getDemoDrivers, getDemoReports } from '../services/demoDataService.js';

const router = express.Router();

// GET /api/demo/buses - Demo buses with OBD parameters
router.get('/buses', (req, res) => {
  try {
    const data = getDemoBuses();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load demo buses' });
  }
});

// GET /api/demo/buses/:id - Single demo bus by ID
router.get('/buses/:id', (req, res) => {
  try {
    const bus = getDemoBusById(req.params.id);
    if (!bus) return res.status(404).json({ error: 'Demo bus not found' });
    res.json({ bus });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load demo bus' });
  }
});

// GET /api/demo/drivers - Demo drivers
router.get('/drivers', (req, res) => {
  try {
    const data = getDemoDrivers();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load demo drivers' });
  }
});

// GET /api/demo/reports - Demo reports data
router.get('/reports', (req, res) => {
  try {
    const data = getDemoReports();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load demo reports' });
  }
});

export default router;
