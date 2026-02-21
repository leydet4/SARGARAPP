const { getStore } = require("@netlify/blobs");

exports.handler = async function (event) {

  try {

    const fileStore = getStore("resources-files");
    const metaStore = getStore("resources-meta");

    // DELETE
    if (event.httpMethod === "DELETE") {

      const fileName = event.queryStringParameters.name;

      await fileStore.delete(fileName);

      const raw = await metaStore.get("list.json");
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

      const fileName = event.headers["x-file-name"];
      const title = event.headers["x-file-title"];

      const buffer = Buffer.from(
        event.body,
        event.isBase64Encoded ? "base64" : "utf8"
      );

      await fileStore.set(fileName, buffer);

      const raw = await metaStore.get("list.json");
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
