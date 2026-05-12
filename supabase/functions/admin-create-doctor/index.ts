// MediQ — Admin-create-doctor (Supabase Edge Function, Deno)
//
// Lets an admin create a brand-new doctor account from the dashboard:
//   1. Verifies the caller (via their JWT) has role='admin'.
//   2. Uses service_role to create the auth user with confirmed=true.
//   3. The handle_new_user trigger creates the matching profile with
//      role='doctor' (we pass role in user_metadata).
//   4. Inserts the doctors row with the provided specialty/bio/license.
//
// Body:
//   { email, password, full_name, phone?, specialty?, bio?, license_number? }
//
// Returns:
//   { user_id, email, full_name }
//
// Secrets:
//   SUPABASE_URL                (auto)
//   SUPABASE_ANON_KEY           (auto)
//   SUPABASE_SERVICE_ROLE_KEY   (auto)

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  specialty_id?: string;
  bio?: string;
  license_number?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST')
    return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    // Caller-bound client (RLS applies) to verify they're admin.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Invalid auth' }, 401);

    const { data: callerProfile, error: profErr } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (profErr) return json({ error: profErr.message }, 500);
    if (callerProfile?.role !== 'admin')
      return json({ error: 'Forbidden — only admins can create doctors' }, 403);

    // Validate body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const { email, password, full_name, phone, specialty_id, bio, license_number } = body;
    if (!email || !password || !full_name)
      return json({ error: 'email, password and full_name are required' }, 400);
    if (password.length < 6)
      return json({ error: 'הסיסמה חייבת להיות לפחות 6 תווים' }, 400);

    // Privileged service-role client
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Create auth user (confirmed, no email verification needed)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone: phone || null,
        role: 'doctor', // picked up by the handle_new_user trigger
      },
    });
    if (createErr || !created?.user) {
      return json({ error: createErr?.message ?? 'Failed to create user' }, 400);
    }
    const newUserId = created.user.id;

    // 2. Ensure profile has role=doctor (in case the trigger didn't or was created earlier)
    const { error: profileFixErr } = await admin
      .from('profiles')
      .update({ role: 'doctor', full_name, phone: phone || null })
      .eq('id', newUserId);
    if (profileFixErr) {
      // rollback the auth user we just made
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: `Profile update failed: ${profileFixErr.message}` }, 500);
    }

    // 3. Insert into doctors
    const { error: doctorErr } = await admin.from('doctors').insert({
      profile_id: newUserId,
      specialty_id: specialty_id || null,
      bio: bio?.trim() || null,
      license_number: license_number?.trim() || null,
      active: true,
    });
    if (doctorErr) {
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: `Doctor row failed: ${doctorErr.message}` }, 500);
    }

    return json({
      user_id: newUserId,
      email,
      full_name,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
