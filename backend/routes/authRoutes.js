import express from 'express';
import { Login, Register, GetProfile, UpdateProfile, checkDbStatus } from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/login', Login);
router.post('/register', Register);
router.get('/db-status', checkDbStatus);

// Protected routes
router.get('/profile', verifyToken, GetProfile);
router.put('/profile', verifyToken, UpdateProfile);

export default router;
