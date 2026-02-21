const { getStore } = require("@netlify/blobs");

exports.handler = async function () {

  try {

    const metaStore = getStore("resources-meta");

    const raw = await metaStore.get("list.json");

    if (!raw) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([])
      };
    }

    let list;

    try {
      list = JSON.parse(raw);
    } catch (err) {
      // If corrupted, reset it
      await metaStore.set("list.json", JSON.stringify([]));
      list = [];
    }

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
