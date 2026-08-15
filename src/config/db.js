const mongoose = require("mongoose");

let isConnected = false;

async function connectToDatabase() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI environment variable is not defined");
  }

  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });

  isConnected = true;
  console.log("MongoDB Atlas Connected Successfully");
  return mongoose.connection;
}

module.exports = { connectToDatabase };
