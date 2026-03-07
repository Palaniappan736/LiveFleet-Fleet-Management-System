# LiveFleet - IoT Based Fleet Management System

LiveFleet is a real-time fleet monitoring system. It connects physical buses to a live web dashboard using IoT hardware, mobile connectivity, and a real-time backend. The goal is simple - give fleet managers live visibility into every bus, and give passengers a way to track arrival times.

---

## What This System Does

Each bus has an OBD-II device plugged into its diagnostic port. That device reads live engine data - speed, RPM, fuel level, coolant temperature, engine load, battery voltage - and sends it over Bluetooth to a mobile app on the driver's phone. The app then publishes that data to our backend server using MQTT. Everything shows up in real time on the web dashboard.

There are two types of logins. Managers and admins get the full dashboard - live map, OBD telemetry, alerts, reports, everything. Students get a simpler view showing which bus is where, the bus registration number, and roughly when it will arrive.

---

## Who Can Use It

| Role | Access |
|------|--------|
| Manager | Full dashboard - live telemetry, OBD data, alerts, monthly reports, settings |
| Admin | Same as manager plus user and system management |
| Student | Simplified view - live map, bus number, current location, arrival time |

---

## Hardware Setup

- OBD-II Bluetooth Adapter - plugs into the vehicle diagnostic port, reads engine parameters
- BLE (Bluetooth Low Energy) - sends OBD data wirelessly to the driver Android phone
- Driver Mobile App - receives BLE data and publishes it to the MQTT broker
- MQTT Broker - routes data from the field to the backend server

---

## Software Stack

Backend
- Node.js + Express - REST API server
- MQTT client - receives live telemetry from buses
- Socket.IO - pushes live updates to the browser without page refresh
- Appwrite - stores bus records, user accounts, and OBD history

Frontend
- React 18 + Vite - web dashboard
- Tailwind CSS - styling
- Recharts - charts and graphs for reports
- Leaflet - live bus location maps

---

## Features

### Live Telemetry
Speed, RPM, fuel level, coolant temperature, engine load, battery voltage - all updating in real time from active MQTT-connected buses.

### Automated Alerts
The system watches for things like:
- Speed over 60 km/h
- Fuel below 20%
- Coolant temperature above 95 C
- Engine load above 80%
- Battery voltage below 11.5V
- Any fault codes (DTCs) detected

### Monthly Reports
Pull a full monthly report for any bus - daily averages for all OBD parameters, distance covered, fault counts, and 12 charts for visual analysis. Export as CSV or plain text.

### Demo Mode
When no MQTT broker is connected, the system runs on simulated data for 30 virtual buses. The dashboard looks and behaves exactly the same - useful for testing and presentations without any hardware.

### Student View
Students log in and see a clean simple page - live map with bus pins, registration number on each card, current GPS coordinates, route, driver name, and estimated arrival time.

---

## System Architecture

``nOBD-II Adapter (Bus)
       |
   Bluetooth
       |
Driver Mobile App
       |
     MQTT
       |
  Backend Server (Node.js)
       |              |
   Appwrite       Socket.IO
  (Database)          |
                 Web Dashboard (React)
              Manager / Admin / Student
`

---

## Demo Access

You can try the system right now without any hardware or MQTT setup. The system runs in demo mode with 30 simulated buses.

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@college.edu | demo123 |
| Student | student@college.edu | demo123 |

---

## Support

For questions or issues, reach out at: livefleets@gmail.com
