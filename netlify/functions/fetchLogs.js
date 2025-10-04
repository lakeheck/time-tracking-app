import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const dbName = "timeTracker";

export async function handler() {
  try {
    await client.connect();
    const db = client.db(dbName);
    const coll = db.collection("logs");

    const docs = await coll.find({}, { projection: { _id: 0 } })
      .sort({ date: 1 })
      .toArray();

    return {
      statusCode: 200,
      body: JSON.stringify(docs)
    };
  } catch (err) {
    console.error("Mongo fetch error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.close();
  }
}
