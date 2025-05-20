import mongoose from 'mongoose';
import { Config } from './config.js';

/**
 * Database connection and management
 */
export class Database {
  static async connect() {
    try {
      if (!Config.MONGODB_URI) {
        console.log('No MongoDB URI provided, continuing without database connection');
        return null;
      }

      const connection = await mongoose.connect(Config.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      console.log('Connected to MongoDB');
      return connection;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      if (Config.NODE_ENV === 'production') {
        throw error;
      }
      console.log('Continuing without database connection in development mode');
      return null;
    }
  }

  static async disconnect() {
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
    }
  }

  static getConnectionStatus() {
    return mongoose.connection.readyState === 1;
  }
}

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await Database.disconnect();
  process.exit(0);
});
