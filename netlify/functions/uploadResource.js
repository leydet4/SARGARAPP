const { getStore } = require("@netlify/blobs");

exports.handler = async function (req) {

  try {

    const fileStore = getStore("resources-files");
    const metaStore = getStore("resources-meta");

    // DELETE
    if (req.httpMethod === "DELETE") {

      const fileName = req.queryStringParameters.name;

      if (!fileName) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "File name required" })
        };
      }

      await fileStore.delete(fileName);

      let raw = await metaStore.get("list.json");
      let list = raw ? JSON.parse(raw) : [];

      const updatedList = list.filter(item => item.file !== fileName);

      await metaStore.set("list.json", JSON.stringify(updatedList));

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // POST
    if (req.httpMethod === "POST") {

      const busboy = require("@fastify/busboy");
      const { Readable } = require("stream");

      const bb = busboy({ headers: req.headers });

      let fileBuffer;
      let fileName;
      let title;

      await new Promise((resolve, reject) => {

        bb.on("file", (name, file, info) => {
          fileName = `${Date.now()}-${info.filename}`;
          const chunks = [];

          file.on("data", chunk => chunks.push(chunk));
          file.on("end", () => {
            fileBuffer = Buffer.concat(chunks);
          });
        });

        bb.on("field", (name, value) => {
          if (name === "title") title = value;
        });

        bb.on("finish", resolve);
        bb.on("error", reject);

        Readable.from(req.body).pipe(bb);
      });

      await fileStore.set(fileName, fileBuffer);

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
