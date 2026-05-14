import express from 'express';
import {
  GetAllBuses, GetBus, CreateBus, UpdateBus, DeleteBus, GetStudentBus
} from '../controllers/busController.js';
import { verifyToken, verifyRole } from '../middleware/auth.js';

const router = express.Router();

// Student route (must come before /:id to avoid matching "student" as an id)
router.get('/student/my-bus', verifyToken, GetStudentBus);

// Public / authenticated routes
router.get('/',    verifyToken, GetAllBuses);
router.get('/:id', verifyToken, GetBus);

// Manager-only routes
router.post('/',      verifyToken, verifyRole(['manager', 'admin']), CreateBus);
router.put('/:id',    verifyToken, verifyRole(['manager', 'admin']), UpdateBus);
router.delete('/:id', verifyToken, verifyRole(['manager', 'admin']), DeleteBus);

export default router;
