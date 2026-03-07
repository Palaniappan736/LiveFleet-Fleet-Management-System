# LiveFleet - Project Summary

LiveFleet is an IoT based fleet management system that provides real-time monitoring of bus fleets through OBD-II telemetry, MQTT data pipelines, and a live web dashboard.

---

## Problem Statement

Fleet operators running large bus networks face a recurring set of problems - no visibility into vehicle health, no way to track buses in real time, manual fuel and maintenance records, and passengers who have no idea when the next bus is arriving. LiveFleet was built to address all of that using affordable IoT hardware and modern web technology.

---

## System Architecture

### Hardware Layer
Each bus has an OBD-II Bluetooth adapter plugged into the vehicle diagnostic port. This adapter reads engine data continuously and broadcasts it over BLE. A driver Android phone pairs with the adapter, reads the OBD data through the mobile app, and sends it to the backend over MQTT.

### Backend Layer
The Node.js backend receives MQTT messages from all active buses, normalises the data, and keeps it in memory for live display. Every 3 minutes it persists a snapshot of OBD data to Appwrite for historical reports. Socket.IO pushes live updates to all connected browser clients instantly.

### Frontend Layer
The React web dashboard has two modes:
- Real Mode - shows only buses currently transmitting via MQTT
- Demo Mode - shows 30 simulated buses with realistic data (for testing and demos)

---

## File Structure

``nliveFleet/
|
+-- backend/
|   +-- index.js                    Server entry, Express + Socket.IO setup
|   +-- config/
|   |   +-- appwrite.js             Appwrite database client
|   +-- controllers/
|   |   +-- authController.js       Login, token generation
|   |   +-- busController.js        Bus CRUD operations
|   |   +-- reportsController.js    Monthly OBD report aggregation
|   |   +-- alertController.js      Alert generation logic
|   +-- routes/
|   |   +-- obdLiveRoutes.js        MQTT live data and system mode API
|   |   +-- demoRoutes.js           Demo mode API endpoints
|   |   +-- reportsRoutes.js        Report and history endpoints
|   +-- services/
|   |   +-- mqttService.js          MQTT connection, data normalisation, persist
|   |   +-- demoDataService.js      Simulated 30-bus fleet data
|   |   +-- systemModeService.js    Runtime demo/real mode switching
|   +-- sockets/
|   |   +-- handlers.js             Socket.IO event broadcasting
|   +-- middleware/
|   |   +-- auth.js                 JWT authentication middleware
|   +-- scripts/
|       +-- mqttSimulator.js        Publishes fake MQTT data for testing
|       +-- seedAppwrite.js         Seeds bus and user data into Appwrite
|       +-- setupAppwrite.js        Creates Appwrite collections and indexes
|
+-- frontend/
    +-- src/
        +-- App.jsx                 Router and all context providers
        +-- context/
        |   +-- AuthContext.jsx     Login state, role, JWT management
        |   +-- TelemetryContext.jsx Single source of bus data (MQTT or demo)
        |   +-- ConnectionContext.jsx Persistent MQTT and DB connection state
        |   +-- SystemModeContext.jsx Demo vs Real mode toggle
        +-- pages/
        |   +-- DashboardPage.jsx   Fleet overview, quick stats
        |   +-- VehiclesPage.jsx    All buses grid view
        |   +-- VehicleDetailPage.jsx Single bus detail with all OBD parameters
        |   +-- AlertsPage.jsx      Live and historical alerts
        |   +-- FleetAnalysisPage.jsx Analytics and fleet health charts
        |   +-- ReportsPage.jsx     Monthly reports with 12 charts and export
        |   +-- StudentDashboard.jsx Student view (map, bus no, ETA)
        |   +-- SettingsPage.jsx    MQTT and DB config (manager only)
        |   +-- Login.jsx           Authentication page
        +-- components/
        |   +-- ConnectionBar.jsx   Sticky MQTT connection status header
        |   +-- ErrorBoundary.jsx   Catches and displays render errors
        |   +-- LeafletMap.jsx      Live bus location map
        +-- services/
            +-- api.js              All Axios API calls to the backend
`

---

## OBD Parameters Tracked

| Parameter | Unit | Alert Threshold |
|-----------|------|----------------|
| Speed | km/h | above 60 km/h |
| RPM | rev/min | above 3500 |
| Fuel Level | % | below 20% |
| Coolant Temperature | C | above 95 C |
| Engine Load | % | above 80% |
| Battery Voltage | V | below 11.5 V |
| Odometer | km | none |
| GPS Location | lat/lng | none |
| Ignition Status | on/off | none |
| Fault Codes (DTCs) | codes | any code present |

---

## Data Flow

1. OBD-II adapter reads engine parameters from bus CAN bus
2. BLE transmits data to driver Android phone
3. Mobile app publishes JSON payload to MQTT topic fleet/{busId}/telemetry
4. Backend MQTT service receives message and normalises fields
5. Socket.IO broadcasts update to all connected browsers (event: obdUpdate)
6. TelemetryContext in React receives the Socket.IO event and updates state
7. All dashboard pages re-render with latest data
8. Every 3 minutes, backend persists a record to Appwrite obd_history collection

---

## Database Collections (Appwrite)

| Collection | Purpose |
|-----------|---------|
| buses | Bus registration, driver, route, capacity metadata |
| users | Staff and student accounts with roles |
| obd_history | Historical OBD snapshots every 3 minutes per active bus |

---

## Development Notes

- The system runs in Demo Mode by default when no MQTT broker is configured
- Real mode is activated by connecting an MQTT broker in the Settings page
- In real mode, only buses actively publishing MQTT messages appear on the dashboard
- Reports pull from obd_history in Appwrite. Buses with no MQTT activity show empty reports
- The frontend build is around 967 KB, built with Vite for fast development

---

## Contact

livefleets@gmail.com
