import express, { Request, Response } from 'express';
import Logger from 'log4js';
import * as dotenv from 'dotenv';
import { getLogsCollection } from '../dbs/mongo';
import { auth } from '../middlewares/auth';

const router = express.Router();
const logger = Logger.getLogger('chatgpt-system');
logger.level = process.env.LOG_LEVEL || 'debug';

dotenv.config();

// eslint-disable-next-line import/no-mutable-exports
let useCrawlerDefault = !process.env.OPENAI_API_KEY;

/**
 * 读取默认的apiKey
 *
 * @export
 * @return {*}
 */
export function getDefaultOpenApiKey() {
  return useCrawlerDefault ? '' : process.env.OPENAI_API_KEY || '';
}

// 暴露一个接口，用于切换模式
router.get('/model', auth, (req: Request, res: Response) => {
  useCrawlerDefault = !useCrawlerDefault;
  res.send({ useCrawlerDefault });
});

// 暴露一个接口，用于获取日志
router.get('/logs', auth, async (req: Request, res: Response) => {
  try {
    const logsCollection = await getLogsCollection();
    const logs = await logsCollection.find().toArray();
    res.json(logs);
  } catch (error) {
    logger.error('Error fetching logs from MongoDB:', error);
    res.status(500).json({ error: 'Error fetching logs from MongoDB' });
  }
});

export default router;
