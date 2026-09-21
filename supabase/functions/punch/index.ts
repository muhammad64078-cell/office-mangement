// Biometric punch ingest edge function.
// Receives { biometric_user_id, punched_at, device_id } from the bridge
// script, saves a raw event, then upserts the attendance row for today.
// Protected by a secret API key header (PUNCH_API_KEY).

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Punch-Key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Authenticate via secret header
    const expectedKey = Deno.env.get("PUNCH_API_KEY");
    if (!expectedKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured: PUNCH_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const providedKey = req.headers.get("X-Punch-Key");
    if (!providedKey || providedKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { biometric_user_id, punched_at, device_id } = body as {
      biometric_user_id?: string;
      punched_at?: string;
      device_id?: string;
    };

    if (!biometric_user_id || !punched_at) {
      return new Response(
        JSON.stringify({ error: "biometric_user_id and punched_at are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const punchedDate = new Date(punched_at);
    if (isNaN(punchedDate.getTime())) {
      return new Response(
        JSON.stringify({ error: "Invalid punched_at" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Save raw event
    const { error: evtErr } = await supabase
      .from("attendance_events")
      .insert({
        biometric_user_id,
        punched_at: punchedDate.toISOString(),
        device_id: device_id ?? null,
        raw_payload: body,
      });
    if (evtErr) throw evtErr;

    // 2. Look up the profile by biometric_user_id
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("biometric_user_id", biometric_user_id)
      .maybeSingle();
    if (profErr) throw profErr;
    if (!profile) {
      return new Response(
        JSON.stringify({
          ok: true,
          warning: `No profile linked to biometric_user_id=${biometric_user_id}. Event saved only.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Determine the attendance date (local calendar day of punch)
    const dateStr = punchedDate.toISOString().slice(0, 10);

    // 4. Fetch office start time
    const { data: settings } = await supabase
      .from("settings")
      .select("office_start_time")
      .eq("id", 1)
      .maybeSingle();
    const officeStart = settings?.office_start_time ?? "09:00";

    // 5. Fetch or create today's parent attendance row
    let attendanceId: string;
    let currentStatus = "present";

    const { data: existingAtt, error: attErr } = await supabase
      .from("attendance")
      .select("id, status, check_in")
      .eq("user_id", profile.id)
      .eq("date", dateStr)
      .maybeSingle();
    if (attErr) throw attErr;

    const [oh, om] = officeStart.split(":").map(Number);
    const officeStartDt = new Date(punchedDate);
    officeStartDt.setHours(oh, om, 0, 0);
    const lateThreshold = new Date(officeStartDt.getTime() + 15 * 60 * 1000);
    const isLate = punchedDate > lateThreshold;

    if (!existingAtt) {
      currentStatus = isLate ? "late" : "present";
      const { data: newAtt, error: insErr } = await supabase
        .from("attendance")
        .insert({
          user_id: profile.id,
          date: dateStr,
          check_in: punchedDate.toISOString(),
          check_out: null,
          total_hours: 0,
          total_break_hours: 0,
          is_on_break: false,
          status: currentStatus,
          source: "biometric",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      attendanceId = newAtt.id;
    } else {
      attendanceId = existingAtt.id;
      currentStatus = existingAtt.status;
    }

    // 6. Fetch existing sessions for this attendance row
    const { data: sessions, error: sessErr } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("attendance_id", attendanceId)
      .order("check_in", { ascending: true });
    if (sessErr) throw sessErr;

    const openSession = (sessions ?? []).find((s) => !s.check_out);

    if (openSession) {
      // De-dupe: Ignore duplicate punches within 2 minutes of check_in
      const openCheckIn = new Date(openSession.check_in);
      const diffMs = Math.abs(punchedDate.getTime() - openCheckIn.getTime());
      if (diffMs < 2 * 60 * 1000) {
        return new Response(
          JSON.stringify({ ok: true, action: "ignored_duplicate" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Close open session (Developer punching OUT / starting BREAK)
      const { error: closeErr } = await supabase
        .from("attendance_sessions")
        .update({ check_out: punchedDate.toISOString() })
        .eq("id", openSession.id);
      if (closeErr) throw closeErr;

      // --- AUTOMATIC TASK PAUSE ---
      const { data: runningTasks } = await supabase
        .from("tasks")
        .select("id, started_at, total_seconds_spent")
        .eq("assigned_to", profile.id)
        .eq("status", "in_progress");

      if (runningTasks && runningTasks.length > 0) {
        for (const task of runningTasks) {
          if (task.started_at) {
            const elapsed = (punchedDate.getTime() - new Date(task.started_at).getTime()) / 1000;
            const newTotal = (task.total_seconds_spent ?? 0) + Math.max(0, elapsed);
            await supabase
              .from("tasks")
              .update({
                status: "todo",
                started_at: null,
                total_seconds_spent: newTotal,
              })
              .eq("id", task.id);
          }
        }
      }

      // Re-fetch all sessions to calculate net working hours and break hours
      const { data: updatedSessions } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("attendance_id", attendanceId)
        .order("check_in", { ascending: true });

      const allSessions = updatedSessions ?? [];
      let totalWorkMs = 0;
      let totalBreakMs = 0;

      for (let i = 0; i < allSessions.length; i++) {
        const sess = allSessions[i];
        if (sess.check_in && sess.check_out) {
          totalWorkMs += new Date(sess.check_out).getTime() - new Date(sess.check_in).getTime();
        }
        if (i > 0) {
          const prevSess = allSessions[i - 1];
          if (prevSess.check_out && sess.check_in) {
            totalBreakMs += new Date(sess.check_in).getTime() - new Date(prevSess.check_out).getTime();
          }
        }
      }

      const totalWorkHours = Math.round((totalWorkMs / 3_600_000) * 100) / 100;
      const totalBreakHours = Math.round((totalBreakMs / 3_600_000) * 100) / 100;

      let finalStatus = currentStatus;
      if (totalWorkHours < 4 && currentStatus === "present") {
        finalStatus = "half_day";
      }

      await supabase
        .from("attendance")
        .update({
          check_out: punchedDate.toISOString(),
          total_hours: totalWorkHours,
          total_break_hours: totalBreakHours,
          is_on_break: true,
          status: finalStatus,
        })
        .eq("id", attendanceId);

      return new Response(
        JSON.stringify({
          ok: true,
          action: "check_out_or_break_start",
          total_hours: totalWorkHours,
          total_break_hours: totalBreakHours,
          is_on_break: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else {
      // No open session: Start new session (Developer punching IN / returning from BREAK)
      const { error: newSessErr } = await supabase
        .from("attendance_sessions")
        .insert({
          attendance_id: attendanceId,
          user_id: profile.id,
          date: dateStr,
          check_in: punchedDate.toISOString(),
          check_out: null,
          session_type: "work",
        });
      if (newSessErr) throw newSessErr;

      const firstCheckIn = existingAtt?.check_in ?? punchedDate.toISOString();
      await supabase
        .from("attendance")
        .update({
          check_in: firstCheckIn,
          check_out: null,
          is_on_break: false,
        })
        .eq("id", attendanceId);

      return new Response(
        JSON.stringify({
          ok: true,
          action: "check_in_or_break_end",
          is_on_break: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
