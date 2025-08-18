const mongoose = require('mongoose');
require('dotenv').config();

const connectDatabase = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const DATABASE_NAME = process.env.DATABASE_NAME || 'rms';
    const USER_NAME = (process.env.USER_NAME || '').trim();
    const PASSWORD = (process.env.PASSWORD || '').trim();

    let mongoUri = '';

    if (USER_NAME && PASSWORD) {
      // Encode special characters in credentials
      const username = encodeURIComponent(USER_NAME);
      const password = encodeURIComponent(PASSWORD);

      if (MONGODB_URI.startsWith('mongodb+srv://') || MONGODB_URI.includes('mongodb.net')) {
        // Likely MongoDB Atlas
        mongoUri = `mongodb+srv://${username}:${password}@${MONGODB_URI.split('://')[1]}/${DATABASE_NAME}`;
      } else {
        // Local or custom Mongo with auth
        mongoUri = `mongodb://${username}:${password}@${MONGODB_URI}/${DATABASE_NAME}?authSource=admin`;
      }
    } else {
      // No credentials → connect without auth
      mongoUri = `${MONGODB_URI}/${DATABASE_NAME}`;
    }

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 7000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(mongoUri, options);

    console.log('✅ Connected to MongoDB');
    console.log(`📂 Database: ${mongoose.connection.db.databaseName}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ MongoDB disconnection error:', error);
    throw error;
  }
};

module.exports = { connectDatabase, disconnectDatabase };
