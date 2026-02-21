import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {

    const fileStore = getStore("resources-files");
    const metaStore = getStore("resources-meta");

    // =========================
    // DELETE FILE
    // =========================
    if (req.method === "DELETE") {

      const url = new URL(req.url);
      const fileName = url.searchParams.get("name");

      if (!fileName) {
        return new Response(
          JSON.stringify({ error: "File name required" }),
          { status: 400 }
        );
      }

      // Delete file blob
      await fileStore.delete(fileName);

      // Get metadata list
      let list = await metaStore.get("list.json", { type: "json" });
      if (!list) list = [];

      // Remove deleted file from list
      const updatedList = list.filter(item => item.file !== fileName);

      // Save updated list
      await metaStore.set("list.json", updatedList);

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // =========================
    // UPLOAD FILE
    // =========================
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

      let list = await metaStore.get("list.json", { type: "json" });
      if (!list) list = [];

      list.unshift({
        name: title || file.name,
        file: fileName,
        uploaded: new Date().toISOString()
      });

      await metaStore.set("list.json", list);

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
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
