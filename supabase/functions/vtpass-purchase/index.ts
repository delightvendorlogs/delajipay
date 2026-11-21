const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({
    success: false,
    retired: true,
    error: "This service endpoint has been retired. Sparkle SMS is the active product."
  }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
