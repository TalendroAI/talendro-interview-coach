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
    const { audioUrl, imageBase64, imageUrl } = await req.json();
    const D_ID_API_KEY = Deno.env.get('D_ID_API_KEY');

    if (!D_ID_API_KEY) {
      throw new Error('D_ID_API_KEY is not configured');
    }

    if (!audioUrl) {
      throw new Error('audioUrl is required');
    }

    // Accept either base64 image data or a URL
    const sourceUrl = imageBase64 
      ? `data:image/jpeg;base64,${imageBase64}`
      : imageUrl;

    if (!sourceUrl) {
      throw new Error('Either imageBase64 or imageUrl is required');
    }

    console.log('Creating D-ID talk video with audio:', audioUrl);
    console.log('Image source type:', imageBase64 ? 'base64' : 'url');

    // Create a talk video
    const createResponse = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${D_ID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_url: sourceUrl,
        script: {
          type: 'audio',
          audio_url: audioUrl,
        },
        config: {
          fluent: true,
          pad_audio: 0,
          stitch: true,
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('D-ID create error:', createResponse.status, errorText);
      throw new Error(`D-ID API error: ${createResponse.status} - ${errorText}`);
    }

    const createData = await createResponse.json();
    console.log('D-ID talk created:', createData);

    const talkId = createData.id;

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout (D-ID can take a while)
    let resultUrl = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.d-id.com/talks/${talkId}`, {
        headers: {
          'Authorization': `Basic ${D_ID_API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('D-ID status error:', statusResponse.status, errorText);
        throw new Error(`D-ID status error: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      console.log('D-ID talk status:', statusData.status, `(attempt ${attempts + 1})`);

      if (statusData.status === 'done') {
        resultUrl = statusData.result_url;
        break;
      } else if (statusData.status === 'error') {
        throw new Error(`D-ID processing failed: ${statusData.error?.message || 'Unknown error'}`);
      }

      attempts++;
    }

    if (!resultUrl) {
      throw new Error('D-ID processing timed out');
    }

    console.log('D-ID video ready:', resultUrl);

    return new Response(
      JSON.stringify({ videoUrl: resultUrl, talkId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in d-id-talk function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
