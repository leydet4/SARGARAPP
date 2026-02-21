import { getStore } from "@netlify/blobs";

export default async () => {

  const metaStore = getStore("resources-meta");
  const list = await metaStore.get("list.json", { type: "json" });

  return new Response(
    JSON.stringify(list || []),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    }
  );
};
