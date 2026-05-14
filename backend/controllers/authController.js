/**
 * authController.js  –  Appwrite-backed auth
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Register  → users.create() + users.updatePrefs(role)
 * Login     → signInWithEmail (REST – password verify) → jsonwebtoken signed JWT
 * Middleware verifies JWT with JWT_SECRET (no Appwrite JWT scope needed)
 */

import jwt from 'jsonwebtoken';
import {
  users, db, DB_ID, COLL,
  signInWithEmail,
  parseObd, parseLocation,
  ID, Query,
} from '../config/appwrite.js';
import { isDemoMode, isDemoLoginAllowed } from '../services/systemModeService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'livefleet-super-secret-key-change-in-prod';
const JWT_TTL    = process.env.JWT_TTL    || '7d';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo123';
const DEMO_EMAIL_DOMAIN = process.env.DEMO_EMAIL_DOMAIN || 'college.edu';

/** Sign our own JWT — no Appwrite JWT scope needed */
const issueJwt = (userId, email, role) =>
  jwt.sign({ uid: userId, email, role }, JWT_SECRET, { expiresIn: JWT_TTL });

const demoRoleFromEmail = (email = '') =>
  email.toLowerCase().includes('manager') || email.toLowerCase().includes('admin')
    ? 'manager' : 'student';

const isDemoEmail = (email = '') =>
  email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);

/* ── GET /api/auth/db-status  (public – no auth needed) ─────────────────── */
export const checkDbStatus = async (req, res) => {
  const start = Date.now();
  if (isDemoMode()) {
    return res.json({ ok: true, latencyMs: 0, count: 0, mode: 'demo', message: 'Demo mode – Appwrite not queried' });
  }
  try {
    // Use db.get (simple GET, no body) to check connectivity
    const database = await db.get(DB_ID);
    return res.json({ ok: true, latencyMs: Date.now() - start, dbName: database.name, mode: 'real', provider: 'appwrite' });
  } catch (err) {
    return res.json({ ok: false, latencyMs: Date.now() - start, message: err.message, mode: 'real' });
  }
};

/* ── POST /api/auth/register ─────────────────────────────────────────────── */
export const Register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (isDemoMode()) {
      const demoRole = role || demoRoleFromEmail(email);
      return res.status(201).json({
        success: true, message: 'Demo user registered',
        token: `demo-${demoRole}`,
        user: { id: `demo-${demoRole}`, name: name || 'Demo User', email, role: demoRole, status: 'active' },
      });
    }

    // 1. Create Appwrite Auth user
    const appUser = await users.create(ID.unique(), email, undefined, password, name || email.split('@')[0]);

    // 2. Set role in prefs (used by middleware)
    const userRole = role || 'student';
    await users.updatePrefs(appUser.$id, { role: userRole });

    // 3. Upsert a users collection doc for profile data
    try {
      await db.createDocument(DB_ID, COLL.USERS, appUser.$id, {
        name:        name || email.split('@')[0],
        email,
        role:        userRole,
        status:      'active',
        assignedBus: '',
      });
    } catch { /* doc may already exist */ }

    // 4. Issue our own signed JWT
    const jwtToken = issueJwt(appUser.$id, email, userRole);

    res.status(201).json({
      success: true, message: 'User registered successfully',
      token: jwtToken,
      user: { id: appUser.$id, name: appUser.name, email, role: userRole, status: 'active' },
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

/* ── POST /api/auth/login ────────────────────────────────────────────────── */
export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    if ((isDemoMode() || isDemoLoginAllowed()) && isDemoEmail(email) && password === DEMO_PASSWORD) {
      const role = demoRoleFromEmail(email);
      return res.json({
        success: true, message: 'Demo login successful',
        token: `demo-${role}`,
        user: { id: `demo-${role}`, email, name: email.split('@')[0], role, status: 'active' },
      });
    }

    // 1. Verify credentials — Appwrite REST creates a session (password verification)
    const session  = await signInWithEmail(email, password);

    // 2. Fetch user prefs (role) using the admin Users SDK
    const appUser  = await users.get(session.userId);
    const role     = appUser.prefs?.role || 'student';

    // 3. Issue our own signed JWT (avoids Appwrite client-side scope restrictions)
    const token    = issueJwt(appUser.$id, appUser.email, role);

    res.json({
      success: true, message: 'Login successful',
      token,
      user: {
        id:    appUser.$id,
        name:  appUser.name,
        email: appUser.email,
        role,
        status: 'active',
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: error.message || 'Invalid credentials' });
  }
};

/* ── GET /api/auth/profile ───────────────────────────────────────────────── */
export const GetProfile = async (req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ user: { id: req.uid, email: req.email, name: 'Demo User', role: req.userRole, status: 'active' } });
    }
    const appUser = await users.get(req.uid);
    res.json({
      user: {
        id:    appUser.$id,
        name:  appUser.name,
        email: appUser.email,
        role:  appUser.prefs?.role || 'student',
        status: 'active',
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/* ── PUT /api/auth/profile ───────────────────────────────────────────────── */
export const UpdateProfile = async (req, res) => {
  try {
    if (isDemoMode()) return res.json({ success: true, message: 'Demo profile updated' });

    const { name, phone } = req.body;
    await users.updateName(req.uid, name);

    // Store phone in prefs alongside role
    const appUser = await users.get(req.uid);
    await users.updatePrefs(req.uid, { ...appUser.prefs, phone });

    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    console.error('Profile update error:', error.message);
    res.status(500).json({ error: error.message });
  }
};


