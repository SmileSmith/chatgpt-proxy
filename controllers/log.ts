/* eslint-disable import/prefer-default-export */
import Logger from 'log4js';
import { getLogsCollection, LogEntry } from '../dbs/mongo';

const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';
const isLogInDB = process.env.MONGODB_LOG;

export async function logChatGPTResponse(log: Partial<LogEntry>) {
  if (!isLogInDB) return;
  try {
    const logsCollection = await getLogsCollection();
    const logEntry = {
      timestamp: new Date(),
      ...log,
    };
    await logsCollection.insertOne(logEntry);
  } catch (error) {
    logger.warn('Error inserting log into MongoDB:', error);
  }
}
