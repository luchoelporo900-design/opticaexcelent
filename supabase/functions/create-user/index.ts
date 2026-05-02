import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Bootstrap check: allow unauthenticated creation when either:
    // a) no profiles exist yet, OR
    // b) the only existing profile is the auto-generated placeholder ("Administrador")
    //    so the real first admin (Luis Martinez) can take over without needing a login.
    const { data: existingProfiles } = await adminClient
      .from("profiles")
      .select("id, full_name");

    const count = existingProfiles?.length ?? 0;
    const isPlaceholderOnly =
      count === 1 && existingProfiles![0].full_name === "Administrador";
    const isBootstrap = count === 0 || isPlaceholderOnly;

    if (!isBootstrap) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "No autorizado. Inicia sesión primero." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: callerProfile } = await callerClient
        .from("profiles")
        .select("role")
        .maybeSingle();

      if (!callerProfile || !["admin", "gerente"].includes(callerProfile.role)) {
        return new Response(JSON.stringify({ error: "Se requiere rol Admin o Gerente para crear usuarios." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { email, password, full_name, role, branch_id } = await req.json();
    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Faltan campos obligatorios: nombre, email, contraseña y rol." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      full_name,
      role,
      branch_id: branch_id || null,
    });

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, bootstrap: isBootstrap }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
