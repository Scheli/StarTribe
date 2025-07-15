import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;

export async function connectToDB() {
  if (db) return db; 

  try {
    await client.connect();
    db = client.db("StarTribeDB");  
    console.log("Connessione a MongoDB stabilita");
    return db;
  } catch (e) {
    console.error("Errore di connessione:", e);
    throw e;
  }
}

export async function GetUtentiConsigliati(db) {
  const utenti = await db.collection("utenti").aggregate([
    { $sample: { size: 3 } }
  ]).toArray();
  return utenti;
}
