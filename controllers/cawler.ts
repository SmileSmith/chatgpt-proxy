import { ChatGPTError } from '@chatgpt-proxy/chatgpt';
import Logger from 'log4js';

const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';

const CRAWLER_MODEL_DEFAULT = 'text-davinci-002-render-sha';
const CRAWLER_MODEL_GPT4 = 'gpt-4';

let plusCrawlerModelChangeTS = 0;
let plusCrawlerModel = process.env.OPENAI_ACCOUNT_MODEL;

/**
 * 获取爬虫模型
 *
 * @export
 * @param {string} apiModel
 * @return {*}
 */
export function getChatGptCrawlerModel(apiModel: string) {
  if (apiModel === CRAWLER_MODEL_GPT4 && plusCrawlerModel === CRAWLER_MODEL_GPT4) {
    return CRAWLER_MODEL_GPT4;
  }
  return apiModel || CRAWLER_MODEL_DEFAULT;
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
    plusCrawlerModel = '';
    // 限额重置时间：官方文档是4小时，优先按接口返回的时间计算
    const clearsInSeconds = err.statusText.match(/clears_in[\s\S]*?(\d+)/)?.[1];
    logger.warn(
      `model_cap_exceeded clears_in:${clearsInSeconds} | plusCrawlerModelChangeTS: ${plusCrawlerModelChangeTS}`
    );
    if (clearsInSeconds) {
      plusCrawlerModelChangeTS = Date.now() + +clearsInSeconds * 1000;
    } else if (!plusCrawlerModelChangeTS) {
      plusCrawlerModelChangeTS = Date.now() + 4 * 60 * 60 * 1000;
    }
  }
}

/**
 * 处理爬虫模型恢复
 *
 * @export
 */
export function handleCrawlerResume() {
  if (plusCrawlerModelChangeTS) {
    if (plusCrawlerModelChangeTS < Date.now()) {
      plusCrawlerModel = process.env.OPENAI_ACCOUNT_MODEL;
      plusCrawlerModelChangeTS = 0;
    } else {
      logger.info(
        '[modelChangeTS]',
        new Date(plusCrawlerModelChangeTS).toLocaleString()
      );
    }
  }
}
