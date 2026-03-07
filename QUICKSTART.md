# LiveFleet - How to Run the Project

This guide explains how to get LiveFleet running on your local machine. You do not need any special setup - just Node.js and a browser.

---

## What You Need Before Starting

- Node.js version 18 or above - download from nodejs.org
- A terminal (Command Prompt, PowerShell, or Terminal)
- Internet connection (for map tiles and Appwrite database)

That is it. No Docker, no cloud setup needed for basic demo mode.

---

## Step 1 - Install Dependencies

Open two terminal windows and run these commands:

Terminal 1 - Backend:
`
cd LiveFleet/backend
npm install
`

Terminal 2 - Frontend:
`
cd LiveFleet/frontend
npm install
`

Wait for both to finish. This only needs to be done once.

---

## Step 2 - Start the Backend

In your first terminal:
`
cd LiveFleet/backend
node index.js
`

You should see:
`
LiveFleet backend running on port 3000
[mqtt] MQTT_URL not set - MQTT disabled (Demo Mode)
`

The MQTT disabled message is normal. It just means no real buses are connected - the system uses simulated demo data instead.

---

## Step 3 - Start the Frontend

In your second terminal:
`
cd LiveFleet/frontend
npm run dev
`

You should see:
`
VITE v5.x.x  ready in 300ms
Local: http://localhost:5173/
`

---

## Step 4 - Open the Dashboard

Go to http://localhost:5173 in your browser.

You will see the login page. Use these credentials:

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@college.edu | demo123 |
| Student | student@college.edu | demo123 |

Log in as Manager to see the full dashboard - live bus map, OBD telemetry, alerts, and reports.

Log in as Student to see the student view - bus locations, registration numbers, and arrival times.

---

## What You Will See in Demo Mode

Since no real buses are connected, the system runs on simulated data for 30 virtual buses. Everything works the same way - the map updates, OBD values change, alerts get triggered - it is just not real vehicle data. This is useful for testing and demonstration purposes.

To switch to real mode, go to the Settings page (manager login required) and enter your MQTT broker details.

---

## If Port 3000 Is Already in Use

Sometimes a previous server session does not close properly. To fix this on Windows:
`
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
`

Then start the backend again.

---

## Running the MQTT Simulator (Optional)

If you want to test real-mode behaviour without actual IoT hardware, there is a simulator script that publishes fake MQTT data:
`
cd LiveFleet/backend
node scripts/mqttSimulator.js
`

This requires a local MQTT broker running (for example, Mosquitto). Make sure your .env file has MQTT_URL set to mqtt://localhost:1883.

---

## Project Folder Locations

| What | Where |
|------|-------|
| Backend server | LiveFleet/backend/index.js |
| Frontend app | LiveFleet/frontend/src/App.jsx |
| Environment config | LiveFleet/backend/.env |
| Database config | LiveFleet/backend/config/appwrite.js |
| Demo data | LiveFleet/backend/services/demoDataService.js |

---

## Common Issues

Login fails or blank screen after login
Make sure the backend is running on port 3000 before opening the frontend.

Map does not load
Check your internet connection. The map uses OpenStreetMap tiles which require internet access.

No buses showing in real mode
Real mode only shows buses that are actively publishing MQTT data. Switch back to demo mode from the Settings page to see the simulated fleet.

---

## Support

For any issues or questions, contact: livefleets@gmail.com
