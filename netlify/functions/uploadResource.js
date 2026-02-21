const { getStore } = require("@netlify/blobs");
const Busboy = require("@fastify/busboy");

exports.handler = async function (event) {

  try {

    const fileStore = getStore("resources-files");
    const metaStore = getStore("resources-meta");

    // ============================
    // DELETE
    // ============================
    if (event.httpMethod === "DELETE") {

      const fileName = event.queryStringParameters?.name;

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

    // ============================
    // UPLOAD
    // ============================
    if (event.httpMethod === "POST") {

      const contentType = event.headers["content-type"];

      if (!contentType || !contentType.includes("multipart/form-data")) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid content type" })
        };
      }

      const busboy = Busboy({
        headers: { "content-type": contentType }
      });

      let fileBuffer = Buffer.alloc(0);
      let fileName = "";
      let title = "";

      const body = Buffer.from(
        event.body,
        event.isBase64Encoded ? "base64" : "utf8"
      );

      await new Promise((resolve, reject) => {

        busboy.on("file", (fieldname, file, info) => {

          fileName = `${Date.now()}-${info.filename}`;

          file.on("data", data => {
            fileBuffer = Buffer.concat([fileBuffer, data]);
          });
        });

        busboy.on("field", (fieldname, value) => {
          if (fieldname === "title") {
            title = value;
          }
        });

        busboy.on("finish", resolve);
        busboy.on("error", reject);

        busboy.end(body);
      });

      if (!fileBuffer.length) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "No file received" })
        };
      }

      // Save file to blobs
      await fileStore.set(fileName, fileBuffer);

      // Update metadata
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
