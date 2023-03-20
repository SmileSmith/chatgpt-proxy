// src/mongoClient.ts
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const client = new MongoClient(uri);

export interface LogEntry {
  messageId: string;
  parentMessageId: string;
  conversationId: string;
  message: string;
  response: string;
  model: string;
  apiKey?: string;
  timestamp: Date;
}

export async function getLogsCollection() {
  await client.connect();
  const db = client.db('chatGptLogs');
  const collection = db.collection('logs');
  return collection;
}

export default client;
