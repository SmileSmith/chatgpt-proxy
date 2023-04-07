import { ChatGPTError } from 'chatgpt';
import { Response } from 'express';
import Logger from 'log4js';
import { LogEntry } from '../dbs/mongo';
import { formatReturn } from './send';

const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';

export const PROXY_ERROR = {
  NoAuthApiKey: '无访问权限',
  Limit: '当前使用人数较多🔥，命中频限，请稍后再试~',
  NotFoundConversation: '会话丢失🤷🏻‍♀️，请关闭chatgpt后重新打开，开始新的会话~',
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
  } if (err.statusCode && +err.statusCode === 404) {
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
