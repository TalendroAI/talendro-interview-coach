import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({} as { agentId?: string; mode?: string }));
    const agentId = body?.agentId;
    const mode = body?.mode;

    if (!agentId) {
      throw new Error('Agent ID is required');
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY_1') || Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }

    const requestMode = mode === 'signed_url' ? 'signed_url' : 'token';

    console.log('Fetching ElevenLabs conversation auth for agent:', agentId, 'mode:', requestMode);

    const url = requestMode === 'signed_url'
      ? `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`
      : `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`;

    const response = await fetch(url, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`Failed to get conversation auth: ${response.status}`);
    }

    const data = await response.json();

    if (requestMode === 'signed_url') {
      const signedUrl = data?.signed_url || data?.signedUrl;
      if (!signedUrl) {
        throw new Error('No signed URL returned');
      }
      console.log('Signed URL received successfully');
      return new Response(
        JSON.stringify({ signedUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = data?.token;
    if (!token) {
      throw new Error('No token returned');
    }
    console.log('Token received successfully');

    return new Response(
      JSON.stringify({ token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
