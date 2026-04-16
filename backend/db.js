const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URL);

let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("expense_splitter");
    console.log("MongoDB connected");
  }
  return db;
}

module.exports = connectDB;