const { getStore } = require("@netlify/blobs");

exports.handler = async function () {

  try {

    const metaStore = getStore("resources-meta");
    const fileStore = getStore("resources-files");

    let raw = await metaStore.get("list.json");

    let list = [];

    // 🔍 If raw exists, try parsing
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch (err) {
        // Corrupted metadata (ex: "[object Object]")
        list = [];
      }
    }

    // 🔥 If metadata empty, rebuild from file store
    if (!Array.isArray(list) || list.length === 0) {

      const files = await fileStore.list();

      list = files.blobs.map(file => ({
        name: file.key,
        file: file.key,
        uploaded: new Date().toISOString()
      }));

      await metaStore.set("list.json", JSON.stringify(list));
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
