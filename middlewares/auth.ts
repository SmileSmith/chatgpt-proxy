/* eslint-disable import/prefer-default-export */
import { Request, Response, NextFunction } from 'express';
import Logger from 'log4js';
import { PROXY_ERROR } from '../controllers/error';
import { formatReturn } from '../controllers/send';

const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';

/**
 * 通用使用和服务端相同的apiKey来校验权限
 *
 * @export
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @return {*}  {void}
 */
export function auth(req: Request, res: Response, next: NextFunction): boolean {
  const authApiKey = process.env.OPENAI_API_KEY;
  if (!authApiKey) {
    next();
    return true;
  }
  try {
    const { apiKey } = { ...req.body, ...req.query } as { apiKey?: string };
    if (!apiKey || apiKey.trim() !== authApiKey.trim()) {
      throw new Error(PROXY_ERROR.NoAuthApiKey);
    }
    next();
    return true;
  } catch (error) {
    res.send(formatReturn({
      id: 'Unauthorized',
      text: error.message ?? 'Please authenticate.',
    }));
    return false;
  }
}
