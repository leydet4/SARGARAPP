import { getStore } from "@netlify/blobs";

export default async (request) => {

  try {

    const url = new URL(request.url);
    const fileName = url.searchParams.get("name");

    if (!fileName) {
      return new Response("Missing file name", { status: 400 });
    }

    const fileStore = getStore("resources-files");

    const file = await fileStore.get(fileName, { type: "arrayBuffer" });

    if (!file) {
      return new Response("File not found", { status: 404 });
    }

    // Determine MIME type
    const extension = fileName.split(".").pop().toLowerCase();

    const mimeTypes = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      txt: "text/plain",
      csv: "text/csv",
      json: "application/json",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      zip: "application/zip"
    };

    const mimeType = mimeTypes[extension] || "application/octet-stream";

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": "inline"
      }
    });

  } catch (error) {
    return new Response("Server error", { status: 500 });
  }
};
