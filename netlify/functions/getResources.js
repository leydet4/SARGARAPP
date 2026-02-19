import { Blob } from "@netlify/blobs";

export default async () => {

  const metaStore = new Blob("resource-metadata");
  const existing = await metaStore.get("list.json");

  if (!existing) {
    return new Response(JSON.stringify([]), { status: 200 });
  }

  return new Response(existing.toString(), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};