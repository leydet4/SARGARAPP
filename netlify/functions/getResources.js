const { getStore } = require("@netlify/blobs");

exports.handler = async function () {

  try {

    const metaStore = getStore("resources-meta");

    let raw = await metaStore.get("list.json");

    if (!raw) {
      await metaStore.set("list.json", JSON.stringify([]));
      raw = "[]";
    }

    let list;

    try {
      list = JSON.parse(raw);
    } catch (err) {
      // Reset if corrupted
      list = [];
      await metaStore.set("list.json", JSON.stringify([]));
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
      body: JSON.stringify({ error: err.message })
    };
  }
};
