// netlify/functions/ping.js
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({ ok: true, ts: new Date().toISOString() })
  };
};
