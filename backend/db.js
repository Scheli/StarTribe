import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let cachedDb = null;

export async function connectToDB() {
  if (cachedDb) return cachedDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI non definito in .env");

  const client = new MongoClient(uri);
  await client.connect();
  cachedDb = client.db("StarTribeDB");
  return cachedDb;
}

export async function aggiungiUtente(utente) {
  try {
    const db = await connectToDB();

    const existingUser = await db.collection("utenti").findOne({ email: utente.email });
    if (existingUser) return null;

    const result = await db.collection("utenti").insertOne(utente);
    return result.insertedId;
  } catch (err) {
    console.error("Errore aggiunta utente:", err);
    return null;
  }
}


export async function GetUtentiConsigliati(db) {
  const utenti = await db.collection("utenti").aggregate([
    { $sample: { size: 3 } }
  ]).toArray();
  return utenti;
}