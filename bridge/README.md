# ZKTeco Biometric Bridge

A small Node.js script that polls a ZKTeco-style fingerprint / thumb
attendance device every 30 seconds and forwards each punch to the Supabase
`punch` Edge Function, which records the event and updates the
`attendance` table.

## Requirements

- Node.js 18+
- A ZKTeco device reachable on the network (e.g. ZKTeco K40, iClock, etc.)
- The `punch` Edge Function deployed to Supabase
- A `PUNCH_API_KEY` secret set on the Supabase project (must match the one
  in the bridge `.env`)

## Setup

1. Install dependencies:

   ```bash
   cd bridge
   npm install
   ```

2. Copy the example env file and fill in the values:

   ```bash
   cp .env.example .env
   ```

   - `SUPABASE_URL` — your Supabase project URL.
   - `PUNCH_API_KEY` — the secret shared with the edge function.
   - `DEVICE_IP` / `DEVICE_PORT` — the IP and port of the ZKTeco device
     (default `192.168.1.201:4370`).

3. Run the bridge:

   ```bash
   npm start
   ```

## How it works

1. The script connects to the device via `node-zklib` every 30 seconds.
2. It fetches all attendance logs and filters out ones already sent.
3. For each new punch it sends a POST to `/functions/v1/punch` with
   `{ biometric_user_id, punched_at, device_id }`.
4. The edge function saves the raw event to `attendance_events`, then
   creates or updates the `attendance` row for that user and day:
   - First punch of the day → sets `check_in` (marks `late` if after the
     grace period).
   - Second punch → sets `check_out` and computes `total_hours`.
   - Punches within 2 minutes of the last one are ignored.

## Linking device users to app profiles

Each user enrolled on the device has a numeric ID. That ID must be entered
as the **Biometric User ID** in the admin's developer management screen so
the bridge's `biometric_user_id` matches a `profiles` row.
