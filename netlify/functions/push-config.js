// netlify/functions/push-config.js
export default async () => {
  const { VAPID_PUBLIC_KEY } = process.env;

  if (!VAPID_PUBLIC_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing_env: VAPID_PUBLIC_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, publicKey: VAPID_PUBLIC_KEY }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  );
};
