import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {

    const fileStore = getStore("resources-files");
    const metaStore = getStore("resources-meta");

    // ===============================
    // SERVE FILE (GET REQUEST)
    // ===============================
    if (req.method === "GET") {

      const url = new URL(req.url);
      const fileName = url.pathname.split("/").pop();

      if (!fileName) {
        return new Response("File not specified", { status: 400 });
      }

      const file = await fileStore.get(fileName, { type: "arrayBuffer" });

      if (!file) {
        return new Response("File not found", { status: 404 });
      }

      return new Response(file, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `inline; filename="${fileName}"`
        }
      });
    }

    // ===============================
    // UPLOAD FILE (POST REQUEST)
    // ===============================
    if (req.method === "POST") {

      const formData = await req.formData();
      const file = formData.get("file");
      const title = formData.get("title");

      if (!file) {
        return new Response(
          JSON.stringify({ error: "No file uploaded" }),
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${Date.now()}-${file.name}`;

      await fileStore.set(fileName, buffer, {
        contentType: file.type
      });

      let list = [];
      const existing = await metaStore.get("list.json", { type: "json" });
      if (existing) list = existing;

      list.unshift({
        name: title || file.name,
        file: fileName,
        uploaded: new Date().toISOString()
      });

      await metaStore.set("list.json", JSON.stringify(list));

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200 }
      );
    }

    return new Response("Method not allowed", { status: 405 });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
};
