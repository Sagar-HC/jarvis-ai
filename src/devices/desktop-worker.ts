import os from 'os';
import { exec } from 'child_process';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const DEVICE_ID = `desktop_${os.hostname()}_${process.pid}`;
const DEVICE_NAME = `${os.hostname()} (Desktop Companion)`;

console.log(`[DESKTOP-WORKER] Starting companion worker on ${os.platform()} (${DEVICE_ID})...`);

async function registerDevice() {
  try {
    const res = await fetch(`${SERVER_URL}/api/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: DEVICE_ID,
        deviceName: DEVICE_NAME,
        deviceType: 'DESKTOP',
        capabilities: ['shell', 'filesystem', 'desktop.interaction']
      })
    });
    if (res.ok) {
      console.log(`[DESKTOP-WORKER] Successfully registered with central server at ${SERVER_URL}`);
    } else {
      console.warn(`[DESKTOP-WORKER] Registration response: ${res.status}`);
    }
  } catch (err: any) {
    console.warn(`[DESKTOP-WORKER] Could not connect to central server: ${err.message}. Retrying...`);
  }
}

async function sendHeartbeat() {
  try {
    await fetch(`${SERVER_URL}/api/devices/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: DEVICE_ID,
        connectionStatus: 'ONLINE'
      })
    });
  } catch (err: any) {
    // server might be restarting
  }
}

// Start worker loop
registerDevice();
setInterval(sendHeartbeat, 15000);

console.log(`[DESKTOP-WORKER] Worker active. Heartbeat interval: 15s.`);
