import jwt from 'jsonwebtoken';
import { users as appwriteUsers } from '../config/appwrite.js';
import { isDemoMode, isDemoLoginAllowed } from '../services/systemModeService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'livefleet-super-secret-key-change-in-prod';

const getDemoRole = (token) => {
  if (typeof token !== 'string') return 'student';
  return token.includes('manager') || token.includes('admin') ? 'manager' : 'student';
};

/**
 * verifyToken
 * Demo mode : accepts "demo-manager" / "demo-student" tokens.
 * Real mode : verifies our own signed JWT (signed by authController with JWT_SECRET).
 *             Falls back to Appwrite prefs lookup if role is missing from token.
 */
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const demoAllowed = isDemoMode() || isDemoLoginAllowed();
    const isDemoToken = typeof token === 'string' && token.startsWith('demo-');

    if (demoAllowed && isDemoToken) {
      req.uid      = 'demo-user';
      req.email    = 'demo@local';
      req.userRole = getDemoRole(token);
      req.isDemo   = true;          // controllers can branch on this
      return next();
    }

    // Verify our own JWT (signed by issueJwt in authController)
    const decoded = jwt.verify(token, JWT_SECRET);
    req.uid      = decoded.uid;
    req.email    = decoded.email;
    req.userRole = decoded.role || 'student';
    req.isDemo   = false;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * verifyRole  – middleware factory; checks req.userRole against allowedRoles.
 * Supports 'admin' as a super-role: admin can access any route.
 */
export const verifyRole = (allowedRoles) => {
  return (req, res, next) => {
    const role = req.userRole || 'student';
    if (role === 'admin' || allowedRoles.includes(role)) {
      return next();
    }
    return res.status(403).json({ error: `Requires one of: ${allowedRoles.join(', ')}` });
  };
};
