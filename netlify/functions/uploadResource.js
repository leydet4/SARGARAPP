import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
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

    const fileStore = getStore("resources-files");
    await fileStore.set(fileName, buffer, {
      contentType: file.type
    });

    const metaStore = getStore("resources-meta");

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

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
};