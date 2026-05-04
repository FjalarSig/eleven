// api/speak.js — Vercel Serverless Function
// Vercel picks this up automatically from the /api folder.
// Your ElevenLabs API key never leaves this function.

export const config = {
  runtime: 'edge', // Faster cold starts than Node runtime
};

const ALLOWED_ORIGINS = [
  'https://fjalar.is',
  'https://www.fjalar.is',
];

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';

  // CORS — only your domain may call this
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const text = (body.text || '').trim();

  if (!text) {
    return new Response(JSON.stringify({ error: 'Texti vantar.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (text.length > 500) {
    return new Response(JSON.stringify({ error: 'Texti má ekki vera lengri en 500 stafir.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const API_KEY  = process.env.ELEVENLABS_API_KEY;
  const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

  if (!API_KEY || !VOICE_ID) {
    return new Response(JSON.stringify({ error: 'Villa í uppsetningu þjóns.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true,
          }
        })
      }
    );

    if (!elRes.ok) {
      const errText = await elRes.text();
      console.error('ElevenLabs error:', elRes.status, errText);
      return new Response(JSON.stringify({ error: 'Raddargerving mistókst. Reyndu aftur.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Stream audio back to the browser
    return new Response(elRes.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      }
    });

  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: 'Innri villa á þjóni.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
