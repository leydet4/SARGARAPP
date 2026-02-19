import { Blob } from "@netlify/blobs";

export default async (req, context) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const title = formData.get("title");

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `${Date.now()}-${file.name}`;

    const store = new Blob("resources");

    await store.set(fileName, buffer, {
      contentType: file.type
    });

    // Get existing metadata
    let metadata = [];
    const metaStore = new Blob("resource-metadata");

    const existing = await metaStore.get("list.json");
    if (existing) {
      metadata = JSON.parse(existing.toString());
    }

    metadata.unshift({
      name: title,
      file: fileName,
      uploaded: new Date().toISOString()
    });

    await metaStore.set("list.json", JSON.stringify(metadata));

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.toString() }), { status: 500 });
  }
};