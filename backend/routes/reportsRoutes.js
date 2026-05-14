import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  getMonthlyReport,
  getHistory,
  exportCSV,
  getFleetSummary,
} from '../controllers/reportsController.js';

const router = express.Router();

router.get('/monthly/:busId',    verifyToken, getMonthlyReport);
router.get('/history/:busId',    verifyToken, getHistory);
router.get('/export/csv/:busId', verifyToken, exportCSV);
router.get('/fleet-summary',     verifyToken, getFleetSummary);

export default router;
