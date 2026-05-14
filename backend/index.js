import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Routes  
import authRoutes from './routes/authRoutes.js';
import obdLiveRoutes from './routes/obdLiveRoutes.js';
import demoRoutes from './routes/demoRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import busRoutes from './routes/busRoutes.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running 🚀' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/obd-live', obdLiveRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/buses', busRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('\n👋 Graceful shutdown initiated...');
  httpServer.close(() => {
    console.log('✅ Server closed cleanly');
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 Graceful shutdown initiated...');
  httpServer.close(() => {
    console.log('✅ Server closed cleanly');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 LiveFleet Backend Server Running                       ║');
  console.log(`║  📍 Server: http://localhost:${PORT}                          ║`);
  console.log(`║  🔌 Socket.io: ws://localhost:${PORT}                         ║`);
  console.log('║  ✅ Status: Ready to accept connections                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
});

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
  }
});

export { app, httpServer, io };
export default app;
