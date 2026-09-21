// ZKTeco -> Supabase punch bridge
// Polls the device every 30s, fetches new attendance logs, and POSTs each
// punch to the Supabase Edge Function `punch`.
//
// Configure via .env (see .env.example):
//   DEVICE_IP, DEVICE_PORT, PUNCH_API_KEY, SUPABASE_URL
//
// Uses node-zklib to talk to the device. The device's internal user ID is
// sent as biometric_user_id, which must match the biometric_user_id column
// in the profiles table for attendance rows to be created.

import ZKLib from "node-zklib";
import "dotenv/config";

const DEVICE_IP = process.env.DEVICE_IP || "192.168.1.201";
const DEVICE_PORT = parseInt(process.env.DEVICE_PORT || "4370", 10);
const SUPABASE_URL = process.env.SUPABASE_URL;
const PUNCH_API_KEY = process.env.PUNCH_API_KEY;
const POLL_INTERVAL_MS = 30_000;
const DEVICE_ID = process.env.DEVICE_ID || "zk-door-1";

if (!SUPABASE_URL || !PUNCH_API_KEY) {
  console.error("Missing SUPABASE_URL or PUNCH_API_KEY in .env");
  process.exit(1);
}

// Track which log timestamps we've already sent to avoid duplicates within
// a single process run. (The edge function also de-dupes within 2 minutes.)
const sentLogIds = new Set();

async function poll() {
  let zk;
  try {
    zk = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000);
    await zk.createSocket();
    console.log(`[bridge] Connected to device ${DEVICE_IP}:${DEVICE_PORT}`);

    const logs = await zk.getAttendances();
    const records = logs?.data || [];

    for (const rec of records) {
      // node-zklib gives: { uid, id, timestamp, type, ... }
      // `id` is the device user id (enrolled fingerprint id)
      const logId = `${rec.uid}-${rec.timestamp}`;
      if (sentLogIds.has(logId)) continue;
      sentLogIds.add(logId);

      // Keep the set from growing forever
      if (sentLogIds.size > 5000) {
        const arr = Array.from(sentLogIds);
        sentLogIds.clear();
        arr.slice(-2500).forEach((x) => sentLogIds.add(x));
      }

      const payload = {
        biometric_user_id: String(rec.id),
        punched_at: rec.timestamp instanceof Date
          ? rec.timestamp.toISOString()
          : new Date(rec.timestamp).toISOString(),
        device_id: DEVICE_ID,
        device_uid: rec.uid,
        type: rec.type,
      };

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/punch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Punch-Key": PUNCH_API_KEY,
          },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) {
          console.error(`[bridge] Punch failed (${res.status}):`, body);
        } else {
          console.log(`[bridge] Sent punch for user ${payload.biometric_user_id}: ${body.action}`);
        }
      } catch (err) {
        console.error(`[bridge] Error sending punch:`, err.message);
      }
    }

    if (records.length === 0) {
      console.log(`[bridge] No new logs.`);
    }
  } catch (err) {
    console.error(`[bridge] Device error:`, err.message || err);
  } finally {
    try {
      if (zk) await zk.disconnect();
    } catch {
      // ignore
    }
  }
}

console.log(`[bridge] Starting ZKTeco bridge — polling every ${POLL_INTERVAL_MS / 1000}s`);
poll();
setInterval(poll, POLL_INTERVAL_MS);
