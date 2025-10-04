import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const dbName = "timeTracker";

export async function handler(event) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const coll = db.collection("config");

    if (event.httpMethod === "GET") {
      const doc = await coll.findOne({}, { projection: { _id: 0 } });
      return { statusCode: 200, body: JSON.stringify(doc || {}) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      await coll.updateOne({}, { $set: { categories: body.categories, updatedAt: new Date() } }, { upsert: true });
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: "Method not allowed" };
  } catch (err) {
    console.error("Config handler error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.close();
  }
}
