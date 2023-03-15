import express from 'express';
import Logger from 'log4js';
import { ChatGPTAPI, ChatGPTError } from 'chatgpt';
import { ChatGPTAPIBrowser } from '@chatgpt-proxy/chatgpt';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';

const chatGptApiMap = new Map<string, ChatGPTAPI>();
let chatGptCrawler: ChatGPTAPIBrowser | null = null;

if (process.env.OPENAI_ACCOUNT_EMAIL) {
  chatGptCrawler = new ChatGPTAPIBrowser({
    debug: process.env.LOG_LEVEL === 'debug',
    model: process.env.OPENAI_ACCOUNT_MODEL,
    isProAccount: !!process.env.OPENAI_ACCOUNT_PLUS,
    email: process.env.OPENAI_ACCOUNT_EMAIL,
    password: process.env.OPENAI_ACCOUNT_PASS,
  });
  chatGptCrawler.initSession();
}

async function handleConversation(req, res) {
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
    apiKey = process.env.OPENAI_API_KEY,
  } = params;

  try {
    // 1. 确保chatGptApi存在
    let istCrawler = false;
    let chatGptInvoker: ChatGPTAPIBrowser | ChatGPTAPI =
      chatGptApiMap.get(apiKey);
    if (!chatGptInvoker && apiKey) {
      chatGptInvoker = new ChatGPTAPI({
        debug: process.env.LOG_LEVEL === 'debug',
        apiKey,
        completionParams: {
          model: process.env.OPENAI_API_MODEL || 'gpt-3.5-turbo',
        },
      });
      chatGptApiMap.set(apiKey, chatGptInvoker);
      logger.info('chatGptApi init', apiKey);
    }
    if (!apiKey && chatGptCrawler) {
      istCrawler = true;
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

    // 3. 发送请求
    const response = await chatGptInvoker?.sendMessage(message, {
      conversationId,
      parentMessageId,
      onProgress(processResponse) {
        logger.debug(processResponse);

        if (istCrawler && processResponse.response) {
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
    logger.info('[message]', message);
    logger.info('[response]', response);
    // 5. 返回全部数据
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: unknown) {
    const err = error as ChatGPTError;
    logger.error('onError:', err.statusCode);
    logger.error('onError:', err.statusCode, err.statusText);
    if (err.statusCode === 429) {
      res.write(
        `data: ${JSON.stringify({
          id: parentMessageId,
          conversationId,
          text: '当前使用人数较多🔥，命中频限，请稍后再试~',
        })}\n\n`
      );
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
      logger.error('onError send SSE End');
      res.write('data: [DONE]\n\n');
      res.end();
    }, 500);
  }
}

const router = express.Router();
router.get('/conversation', handleConversation);
router.post('/conversation', handleConversation);

export default router;
