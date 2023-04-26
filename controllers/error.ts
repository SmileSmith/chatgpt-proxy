import { ChatGPTError } from 'chatgpt';
import { Response } from 'express';
import Logger from 'log4js';
import { LogEntry } from '../dbs/mongo';
import { formatReturn } from './send';
import { ConversationParams } from '../routes/api';

const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';

export const PROXY_ERROR = {
  NoAuthApiKey: '无访问权限',
  Limit: '当前使用人数较多🔥，命中频限，请稍后再试~',
  NotFoundConversation: '会话丢失🤷🏻‍♀️，请关闭chatgpt后重新打开，开始新的会话~',
  Unauthorized: 'apiKey在OPENAI验证失效，请检查apiKey及账户余额后重试~',
  Update: process.env.UPDTAE_CLIENT_TIP || '您的版本过低，请升级后使用~',
  Unknown: '未知异常，请稍后再试~',
};

/**
 * 处理接口SSE完成
 *
 * @export
 * @param {Response} res
 * @return {*}
 */
export function handleApiDone(res: Response) {
  res.write('data: [DONE]\n\n');
  res.end();
}

/**
 * 处理客户端版本过低
 *
 * @export
 * @param {ConversationParams} params
 * @return {boolean}
 */
export function handleUpdate(params: ConversationParams, res: Response) {
  if (
    process.env.UPDTAE_CLIENT_VERSION &&
    (!params.clientVersion ||
      params.clientVersion < process.env.UPDTAE_CLIENT_VERSION)
  ) {
    res.write(
      formatReturn({
        id: '0',
        conversationId: '0',
        text: PROXY_ERROR.Update,
      })
    );
    setTimeout(() => handleApiDone(res), 200);
    return false;
  }
  return true;
}

/**
 * 处理接口调用异常
 *
 * @export
 * @param {ChatGPTError} err
 * @param {Response} res
 * @param {Partial<LogEntry>} params
 * @return {*}
 */
export function handleApiError(
  err: ChatGPTError,
  res: Response,
  params: Partial<LogEntry>
) {
  logger.error(err);
  if (err.statusCode && +err.statusCode === 429) {
    res.write(
      formatReturn({
        id: params.parentMessageId,
        conversationId: params.conversationId,
        text: PROXY_ERROR.Limit,
      })
    );
  }
  if (err.statusCode && +err.statusCode === 404) {
    res.write(
      formatReturn({
        id: params.parentMessageId,
        conversationId: params.conversationId,
        text: PROXY_ERROR.NotFoundConversation,
      })
    );
  }
  if (err.statusCode && +err.statusCode === 401) {
    res.write(
      formatReturn({
        id: params.parentMessageId,
        conversationId: params.conversationId,
        text: PROXY_ERROR.NotFoundConversation,
      })
    );
  } else {
    res.write(
      formatReturn({
        id: params.parentMessageId,
        conversationId: params.conversationId,
        text: err.statusText || err.message || PROXY_ERROR.Unknown,
      })
    );
  }

  setTimeout(() => handleApiDone(res), 200);
}
