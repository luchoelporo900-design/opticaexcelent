import "jsr:@supabase/functions-js/edge-runtime.d.ts";
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
 
// Esta función fue desactivada. El sistema ahora usa localStorage.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ success: true, message: "Usuarios gestionados localmente." }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
 