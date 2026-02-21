const { getStore } = require("@netlify/blobs");

exports.handler = async function (event) {
  try {
    const fileStore = getStore("resources-files");
    const metaStore = getStore("resources-meta");

    // DELETE
    if (event.httpMethod === "DELETE") {
      const fileName = event.queryStringParameters.name;

      if (!fileName) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "File name required" })
        };
      }

      await fileStore.delete(fileName);

      let raw = await metaStore.get("list.json");
      let list = raw ? JSON.parse(raw) : [];

      list = list.filter(item => item.file !== fileName);

      await metaStore.set("list.json", JSON.stringify(list));

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // UPLOAD
    if (event.httpMethod === "POST") {

      const buffer = Buffer.from(event.body, "base64");

      const fileName = event.headers["x-file-name"];
      const title = event.headers["x-file-title"];

      if (!fileName) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "File name missing" })
        };
      }

      await fileStore.set(fileName, buffer);

      let raw = await metaStore.get("list.json");
      let list = raw ? JSON.parse(raw) : [];

      list.unshift({
        name: title || fileName,
        file: fileName,
        uploaded: new Date().toISOString()
      });

      await metaStore.set("list.json", JSON.stringify(list));

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    return { statusCode: 405 };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
