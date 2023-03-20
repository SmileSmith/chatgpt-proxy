import express, { Request, Response } from 'express';
import Logger from 'log4js';
import { ChatGPTAPI, ChatGPTError, ChatMessage } from 'chatgpt';
import { ChatGPTAPIBrowser, ChatResponse } from '@chatgpt-proxy/chatgpt';
import * as dotenv from 'dotenv';
import { getLogsCollection, LogEntry } from '../dbs/mongo';

dotenv.config();

const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';

const chatGptApiMap = new Map<string, ChatGPTAPI>();
const chatGptApiModel = process.env.OPENAI_API_MODEL || 'gpt-3.5-turbo';

let useCrawlerDefault = !process.env.OPENAI_API_KEY;
let chatGptCrawler: ChatGPTAPIBrowser | null = null;
// eslint-disable-next-line no-undef
let chatGptCrawlerChangeTS = 0;
let chatGptCrawlerModel = process.env.OPENAI_ACCOUNT_MODEL;
const DEFAULT_CRAWLER_MODEL = process.env.OPENAI_ACCOUNT_PLUS ? 'text-davinci-002-render-paid' : 'text-davinci-002-render-sha';

if (process.env.OPENAI_ACCOUNT_EMAIL) {
  chatGptCrawler = new ChatGPTAPIBrowser({
    debug: process.env.LOG_LEVEL === 'debug',
    isProAccount: !!process.env.OPENAI_ACCOUNT_PLUS,
    email: process.env.OPENAI_ACCOUNT_EMAIL,
    password: process.env.OPENAI_ACCOUNT_PASS,
  });
  chatGptCrawler.initSession();
}

async function handleConversation(req: Request, res: Response) {
  const params = { ...req.body, ...req.query } as {
    message: string;
    conversationId: string;
    parentMessageId: string;
    apiKey?: string;
  };
  const {
    message,
    conversationId,
    parentMessageId,
  } = params;
  let { apiKey } = params;

  try {
    // 1. 确保chatGptApi存在
    let isCrawler = false;
    let chatGptInvoker: ChatGPTAPIBrowser | ChatGPTAPI
    apiKey = apiKey || !useCrawlerDefault && process.env.OPENAI_API_KEY;
    if (apiKey) {
      chatGptInvoker = chatGptApiMap.get(apiKey);
      if (!chatGptInvoker) {
        chatGptInvoker = new ChatGPTAPI({
          debug: process.env.LOG_LEVEL === 'debug',
          apiKey,
          completionParams: {
            model: chatGptApiModel,
          },
        });
        chatGptApiMap.set(apiKey, chatGptInvoker);
        logger.info('chatGptApi init', apiKey);
      }
    }
    if (!apiKey && chatGptCrawler) {
      isCrawler = true;
      chatGptInvoker = chatGptCrawler;
    }
    if (!chatGptInvoker) {
      throw new Error('请配置您的apiKey');
    }

    // 2. 设置响应头
    const headers = {
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream;charset=utf-8',
      'Cache-Control': 'no-cache',
    };
    res.writeHead(200, headers);

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    // 3. 发送请求
    const response = await chatGptInvoker?.sendMessage(message, {
      model: isCrawler ? chatGptCrawlerModel : '',
      conversationId,
      parentMessageId,
      // API模式通过TCP方式直接处理close，不需要额外传abortSignal
      abortSignal: isCrawler ? abortController.signal : null,
      onProgress(processResponse) {
        logger.debug(processResponse);

        if (isCrawler && processResponse.response) {
          const data = processResponse as any;
          data.id = data.messageId;
          data.text = data.response;
          // 4. 逐步返回数据
          res.write(`data: ${JSON.stringify(data)}\n\n`);
          return;
        }

        if (processResponse.text) {
          // 4. 逐步返回数据
          res.write(`data: ${JSON.stringify(processResponse)}\n\n`);
        }
      },
    });

    logger.debug('[model]', isCrawler ? chatGptCrawlerModel || DEFAULT_CRAWLER_MODEL : chatGptApiModel);
    if (apiKey) logger.debug('[apiKey]', apiKey);
    if (chatGptCrawlerChangeTS) {
      if (chatGptCrawlerChangeTS < Date.now()) {
        chatGptCrawlerModel = process.env.OPENAI_ACCOUNT_MODEL;
        chatGptCrawlerChangeTS = 0;
      } else {
        logger.info('[modelChangeTS]', new Date(chatGptCrawlerChangeTS).toLocaleString());
      }
    }

    logger.debug('[message]', message);
    logger.debug('[response]', response);

    // 4. 记录日志
    const logsCollection = await getLogsCollection();
    const logEntry: LogEntry = {
      messageId: (response as ChatMessage).id || (response as ChatResponse).messageId,
      parentMessageId,
      conversationId,
      message,
      response: (response as ChatMessage).text || (response as ChatResponse).response,
      model: isCrawler ? chatGptCrawlerModel || DEFAULT_CRAWLER_MODEL : chatGptApiModel,
      apiKey,
      timestamp: new Date(),
    };
    await logsCollection.insertOne(logEntry);

    // 5. 返回全部数据
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: unknown) {
    const err = error as ChatGPTError;
    logger.warn(`onError: ${err.statusCode}`);
    if (+err.statusCode === 429) {
      res.write(
        `data: ${JSON.stringify({
          id: parentMessageId,
          conversationId,
          text: '当前使用人数较多🔥，命中频限，请稍后再试~',
        })}\n\n`
      );
      if (/model_cap_exceeded/.test(err.statusText)) {
        // 命中模型限额
        chatGptCrawlerModel = '';
        // 限额重置时间：官方文档是4小时，优先按接口返回的时间计算
        const clearsInSeconds = err.statusText.match(/clears_in[\s\S]*?(\d+)/)?.[1];
        logger.error(`model_cap_exceeded clears_in:${clearsInSeconds} | chatGptCrawlerChangeTS: ${chatGptCrawlerChangeTS}`);
        if (clearsInSeconds) {
          chatGptCrawlerChangeTS = Date.now() + (+clearsInSeconds * 1000);
        } else if (!chatGptCrawlerChangeTS) {
          chatGptCrawlerChangeTS = Date.now() + 4 * 60 * 60 * 1000;
        }
      }
    } else {
      res.write(
        `data: ${JSON.stringify({
          id: parentMessageId,
          conversationId,
          text: err.statusText || err.message || '未知异常，请稍后再试~',
        })}\n\n`
      );
    }
    setTimeout(() => {
      logger.warn('onError send SSE End');
      res.write('data: [DONE]\n\n');
      res.end();
    }, 500);
  }
}

const router = express.Router();
router.get('/conversation', handleConversation);
router.post('/conversation', handleConversation);

// 暴露一个接口，用于切换模式
router.get('/model', (req: Request, res: Response) => {
  useCrawlerDefault = !useCrawlerDefault
  res.send({ useCrawlerDefault });
});

// 暴露一个接口，用于获取日志
router.get('/logs', async (req: Request, res: Response) => {
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
