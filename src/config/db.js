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

  // Optimize for AWS Lambda serverless execution to prevent connection exhaustion on MongoDB Atlas M0
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 1, // Strict single connection per serverless container
    minPoolSize: 1,
    socketTimeoutMS: 20000,
    connectTimeoutMS: 5000,
    maxIdleTimeMS: 15000, // Reclaim idle connection slots quickly
  });

  isConnected = true;
  return mongoose.connection;
}

module.exports = { connectToDatabase };
