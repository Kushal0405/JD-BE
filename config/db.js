const mongoose = require('mongoose');

// Cache the connection across serverless invocations (Vercel cold-start safe)
let cached = global._mongoose || { conn: null, promise: null };
if (!global._mongoose) global._mongoose = cached;

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // allow retry on next call
    throw err;
  }

  return cached.conn;
}

module.exports = connectDB;