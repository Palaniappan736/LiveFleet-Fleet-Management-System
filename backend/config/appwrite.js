/**
 * appwrite.js  –  Appwrite server-side client
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces Firebase Admin SDK entirely.
 * Uses node-appwrite with the API key for all server-side operations.
 *
 * Collections (created by: node backend/scripts/setupAppwrite.js):
 *   Database : livefleet
 *   buses        – fleet vehicle documents
 *   users        – user profiles + roles
 *   obd_history  – immutable MQTT telemetry log
 */

import { Client, Databases, Users, Account, ID, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

export const APPWRITE_ENDPOINT   = process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '6999d3e40018ddea5615';
export const APPWRITE_API_KEY    = process.env.APPWRITE_API_KEY;

export const DB_ID  = process.env.APPWRITE_DB_ID || 'livefleet';
export const COLL   = {
  BUSES:       'buses',
  USERS:       'users',
  OBD_HISTORY: 'obd_history',
};

/* ── Server-side admin client (uses API key) ─────────────────────────────── */
export const adminClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

export const db    = new Databases(adminClient);
export const users = new Users(adminClient);

/* ── Build a per-request client that uses the user's JWT ─────────────────── */
export const makeUserClient = (jwt) => {
  const c = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setJWT(jwt);
  return { client: c, account: new Account(c) };
};

/* ── Helper: create JWT using SDK client with session secret ──────────────── */
// NOTE: Appwrite Account JWT APIs are client-side only (browser sessions).
// From a Node.js server we sign our own JWT with jsonwebtoken instead.
// This function is kept as a no-op shim so imports don't break.
export const createJwtFromSession = async (_sessionSecret) => {
  throw new Error('Use signInAndIssueJwt() in authController instead of createJwtFromSession()');
};

/* ── Helper: verify email+password via Appwrite REST (credential check only) */
export const signInWithEmail = async (email, password) => {
  // POST /account/sessions/email — Appwrite verifies the password server-side
  const r = await fetch(`${APPWRITE_ENDPOINT}/account/sessions/email`, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'X-Appwrite-Project': APPWRITE_PROJECT_ID,
      // No API key — this must be a "client" request so Appwrite validates the credentials
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || 'Invalid credentials');
  return data;  // { $id: sessionId, userId, secret, ... }
};

/* ── Helper: parse OBD JSON field safely ─────────────────────────────────── */
export const parseObd = (doc) => {
  try { return typeof doc.obd === 'string' ? JSON.parse(doc.obd) : doc.obd || {}; }
  catch { return {}; }
};

export const parseLocation = (doc) => {
  try { return typeof doc.location === 'string' ? JSON.parse(doc.location) : doc.location || null; }
  catch { return null; }
};

/* ── Re-export SDK helpers so controllers don't need to import SDK ─────────── */
export { ID, Query };
