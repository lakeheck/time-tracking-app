import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const dbName = "timeTracker";

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    await client.connect();
    const db = client.db(dbName);
    const coll = db.collection("logs");

    // upsert by date to avoid duplicates
    await coll.updateOne(
      { date: body.date },
      { $set: { entries: body.entries, updatedAt: new Date() } },
      { upsert: true }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("Mongo push error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.close();
  }
}
