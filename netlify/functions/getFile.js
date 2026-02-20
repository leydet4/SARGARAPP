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

    let mimeType = "application/octet-stream";

    if (extension === "pdf") mimeType = "application/pdf";
    if (extension === "png") mimeType = "image/png";
    if (extension === "jpg" || extension === "jpeg") mimeType = "image/jpeg";
    if (extension === "gif") mimeType = "image/gif";
    if (extension === "webp") mimeType = "image/webp";

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
