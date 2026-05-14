import { db, DB_ID, ID, Query } from '../config/appwrite.js';

const GEOFENCES_COLL = 'geofences';

// Real-time location updates
export const handleLocationUpdate = (io, socket) => {
  socket.on('busLocationUpdate', async (data) => {
    const { busId, latitude, longitude } = data;

    // Broadcast to all connected clients
    io.emit('busLocationUpdate', {
      busId,
      latitude,
      longitude,
      timestamp: new Date()
    });

    // Check geofencing
    checkGeofence(busId, latitude, longitude, io);
  });
};

// Check if bus is within geofence
const checkGeofence = async (busId, latitude, longitude, io) => {
  try {
    const result = await db.listDocuments(DB_ID, GEOFENCES_COLL, [Query.limit(100)]);

    result.documents.forEach((geo) => {
      const distance = calculateDistance(latitude, longitude, geo.centerLat, geo.centerLng);
      if (distance <= geo.radius) {
        io.emit('geofenceAlert', {
          busId,
          message: `Bus entered zone: ${geo.name}`,
          type: 'enter',
          zone: geo.name,
        });
      }
    });
  } catch (error) {
    console.error('Geofence check error:', error);
  }
};

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Handle fuel alerts
export const handleFuelAlert = (io, socket) => {
  socket.on('fuelAlert', (data) => {
    const { busId, fuelLevel } = data;

    if (fuelLevel < 15) {
      io.emit('fuelAlert', {
        busId,
        fuelLevel,
        message: `Low fuel alert for bus ${busId}`,
        severity: 'high'
      });
    }
  });
};

// Handle maintenance alerts
export const handleMaintenanceAlert = (io, socket) => {
  socket.on('maintenanceAlert', (data) => {
    io.emit('maintenanceAlert', data);
  });
};

// Handle vehicle health monitoring
export const handleVehicleHealth = (io, socket) => {
  socket.on('vehicleHealthUpdate', (data) => {
    const { busId, engineTemp, batteryVoltage, rpm } = data;

    const alerts = [];

    if (engineTemp > 120) {
      alerts.push({
        type: 'HIGH_TEMP',
        message: `Engine temperature too high: ${engineTemp}°C`
      });
    }

    if (batteryVoltage < 11.5 || batteryVoltage > 14.5) {
      alerts.push({
        type: 'BATTERY_VOLTAGE',
        message: `Abnormal battery voltage: ${batteryVoltage}V`
      });
    }

    if (rpm > 5000) {
      alerts.push({
        type: 'HIGH_RPM',
        message: `Engine RPM too high: ${rpm}`
      });
    }

    if (alerts.length > 0) {
      io.emit('healthAlert', {
        busId,
        alerts,
        engineTemp,
        batteryVoltage,
        rpm
      });
    }
  });
};

// Handle overspeeding
export const handleSpeedMonitoring = (io, socket) => {
  socket.on('speedUpdate', (data) => {
    const { busId, speed } = data;

    if (speed > 80) {
      io.emit('speeding', {
        busId,
        speed,
        message: `Bus exceeding speed limit: ${speed} km/h`
      });
    }
  });
};

// Connection handler
export const handleConnection = (io, socket) => {
  console.log('New client connected:', socket.id);

  handleLocationUpdate(io, socket);
  handleFuelAlert(io, socket);
  handleMaintenanceAlert(io, socket);
  handleVehicleHealth(io, socket);
  handleSpeedMonitoring(io, socket);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
};
