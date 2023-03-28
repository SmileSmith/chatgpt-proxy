import { ChatGPTError } from '@chatgpt-proxy/chatgpt';
import Logger from 'log4js';

const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';

let chatGptCrawlerChangeTS = 0;
let chatGptCrawlerModel = process.env.OPENAI_ACCOUNT_MODEL;
const DEFAULT_CRAWLER_MODEL = process.env.OPENAI_ACCOUNT_PLUS
  ? 'text-davinci-002-render-paid'
  : 'text-davinci-002-render-sha';

/**
 * 获取爬虫模型
 *
 * @export
 * @return {*}
 */
export function getChatGptCrawlerModel() {
  return chatGptCrawlerModel || DEFAULT_CRAWLER_MODEL;
}

/**
 * 处理爬虫调用超过限制
 *
 * @export
 * @param {ChatGPTError} err
 */
export function handleCrawlerError(err: ChatGPTError) {
  if (
    err.statusCode &&
    +err.statusCode === 429 &&
    err.statusText &&
    /model_cap_exceeded/.test(err.statusText)
  ) {
    // 命中模型限额
    chatGptCrawlerModel = '';
    // 限额重置时间：官方文档是4小时，优先按接口返回的时间计算
    const clearsInSeconds = err.statusText.match(/clears_in[\s\S]*?(\d+)/)?.[1];
    logger.warn(
      `model_cap_exceeded clears_in:${clearsInSeconds} | chatGptCrawlerChangeTS: ${chatGptCrawlerChangeTS}`
    );
    if (clearsInSeconds) {
      chatGptCrawlerChangeTS = Date.now() + +clearsInSeconds * 1000;
    } else if (!chatGptCrawlerChangeTS) {
      chatGptCrawlerChangeTS = Date.now() + 4 * 60 * 60 * 1000;
    }
  }
}

/**
 * 处理爬虫模型恢复
 *
 * @export
 */
export function handleCrawlerResume() {
  if (chatGptCrawlerChangeTS) {
    if (chatGptCrawlerChangeTS < Date.now()) {
      chatGptCrawlerModel = process.env.OPENAI_ACCOUNT_MODEL;
      chatGptCrawlerChangeTS = 0;
    } else {
      logger.info(
        '[modelChangeTS]',
        new Date(chatGptCrawlerChangeTS).toLocaleString()
      );
    }
  }
}
