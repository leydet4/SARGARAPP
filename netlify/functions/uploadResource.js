import { getStore } from "@netlify/blobs";

export default async () => {

  try {

    const metaStore = getStore("resources-meta");

    const raw = await metaStore.get("list.json");

    if (!raw) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    let list;

    try {
      list = JSON.parse(raw);
    } catch (err) {
      // If corrupted, reset it
      await metaStore.set("list.json", JSON.stringify([]));
      list = [];
    }

    return new Response(
      JSON.stringify(list),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (err) {

    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
