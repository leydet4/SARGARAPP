const { getStore } = require("@netlify/blobs");

exports.handler = async function () {
  try {
    const metaStore = getStore("resources-meta");

    const raw = await metaStore.get("list.json");
    const list = raw ? JSON.parse(raw) : [];

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(list)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
