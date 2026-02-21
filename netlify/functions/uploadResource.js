const { getStore } = require("@netlify/blobs");
const Busboy = require("@fastify/busboy");

exports.handler = async function (event) {

  if (event.httpMethod !== "POST") {
    return { statusCode: 405 };
  }

  try {

    const fileStore = getStore("resources-files");
    const metaStore = getStore("resources-meta");

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

    const body = Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");

    await new Promise((resolve, reject) => {

      busboy.on("file", (fieldname, file, info) => {
        fileName = `${Date.now()}-${info.filename}`;

        file.on("data", data => {
          fileBuffer = Buffer.concat([fileBuffer, data]);
        });
      });

      busboy.on("field", (fieldname, val) => {
        if (fieldname === "title") {
          title = val;
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

    // Save file
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

  } catch (err) {

    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
