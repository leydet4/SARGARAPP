import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {

    const url = new URL(req.url);
    const fileName = url.searchParams.get("name");

    if (!fileName) {
      return new Response("File not specified", { status: 400 });
    }

    const fileStore = getStore("resources-files");
    const file = await fileStore.get(fileName, { type: "arrayBuffer" });

    if (!file) {
      return new Response("File not found", { status: 404 });
    }

    const extension = fileName.split(".").pop().toLowerCase();

    const mimeTypes = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml"
    };

    const mimeType = mimeTypes[extension] || "application/octet-stream";

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff"
      }
    });

  } catch (err) {
    return new Response("Server error", { status: 500 });
  }
};
