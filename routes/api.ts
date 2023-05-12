import express, { Request, Response } from 'express';
import Logger from 'log4js';
import { ChatGPTAPI, ChatGPTError, ChatMessage } from 'chatgpt';
import { ChatGPTAPIBrowser, ChatResponse } from '@chatgpt-proxy/chatgpt';
import * as dotenv from 'dotenv';
import {
  handleApiDone,
  handleApiError,
  handleUpdate,
} from '../controllers/error';
import { formatReturn } from '../controllers/send';
import { getDefaultOpenApiKey } from './sys';
import {
  getChatGptCrawlerModel,
  handleCrawlerError,
  handleCrawlerResume,
} from '../controllers/cawler';
import { logChatGPTResponse } from '../controllers/log';

dotenv.config();

const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';

export interface ConversationParams {
  // 用户发送的消息
  message: string;
  // 对话id
  conversationId: string;
  // 父消息id
  parentMessageId: string;
  // 当前消息使用的模型
  model?: string;
  // 当前消息使用的apikey
  apiKey?: string;
  // 不使用流式返回（等待所有数据返回后，返回最终回答，较慢，仅建议API模式使用）
  noStreaming?: 1;
  // 客户端版本号
  clientVersion?: string;
}

interface ConversationResponse {
  messageId: string;
  parentMessageId: string;
  conversationId: string;
  message: string;
  response: string;
  model: string;
  apiKey: string;
}

const chatGptApiMap = new Map<string, ChatGPTAPI>();
const DEFAULT_API_MODEL = process.env.OPENAI_API_MODEL || 'gpt-3.5-turbo';

let chatGptCrawler: ChatGPTAPIBrowser | null = null;

if (process.env.OPENAI_ACCOUNT_EMAIL && process.env.OPENAI_ACCOUNT_PASS) {
  chatGptCrawler = new ChatGPTAPIBrowser({
    debug: process.env.LOG_LEVEL === 'debug',
    email: process.env.OPENAI_ACCOUNT_EMAIL,
    password: process.env.OPENAI_ACCOUNT_PASS,
  });
  chatGptCrawler.initSession();
}

export async function handleChatGPT(
  req: Request,
  res: Response,
  params: ConversationParams,
  onProgress?: (partialResponse: ChatMessage) => void
): Promise<ConversationResponse> {
  const {
    message,
    conversationId,
    parentMessageId,
    apiKey,
    model: apiModel,
  } = params;
  // 1. 确保chatGptApi存在
  let isCrawler = false;
  let chatGptInvoker: ChatGPTAPIBrowser | ChatGPTAPI | undefined;
  if (apiKey) {
    chatGptInvoker = chatGptApiMap.get(apiKey);
    if (!chatGptInvoker) {
      chatGptInvoker = new ChatGPTAPI({
        debug: process.env.LOG_LEVEL === 'debug',
        apiKey,
        completionParams: {
          model: DEFAULT_API_MODEL,
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

  const model = isCrawler
    ? getChatGptCrawlerModel(apiModel)
    : apiModel || DEFAULT_API_MODEL;

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  // 3. 发送请求
  const response = await chatGptInvoker?.sendMessage(message, {
    // 爬虫模式model传这里
    model,
    conversationId,
    parentMessageId,
    // API模式通过TCP方式直接处理close，不需要额外传abortSignal
    abortSignal: isCrawler ? abortController.signal : undefined,
    // API模式model传这里
    completionParams: { model },
    onProgress: (partialResponse: ChatMessage | ChatResponse) => {
      if (isCrawler && (partialResponse as ChatResponse).response) {
        const data = partialResponse as any;
        data.id = data.messageId;
        data.text = data.response;
        onProgress?.(data);
        return;
      }
      onProgress?.(partialResponse as ChatMessage);
    },
  });

  logger.debug('[apiKey]', apiKey);
  logger.debug('[model]', model);
  logger.debug('[message]', message);
  logger.debug('[response]', response);

  const chatGPTResponse: ConversationResponse = {
    messageId:
      (response as ChatMessage).id || (response as ChatResponse).messageId,
    parentMessageId,
    conversationId,
    message,
    response:
      (response as ChatMessage).text || (response as ChatResponse).response,
    model,
    apiKey,
  };

  // 4. 其他处理
  // 4.1 爬虫模式重新判断模型
  handleCrawlerResume();
  // 4.2 记录日志
  logChatGPTResponse(chatGPTResponse);
  return chatGPTResponse;
}

async function handleConversation(req: Request, res: Response) {
  const params = { ...req.body, ...req.query } as ConversationParams;
  const { message, conversationId, parentMessageId } = params;
  let { apiKey } = params;
  apiKey = apiKey || getDefaultOpenApiKey();

  try {
    if (!message) throw new Error('请传入message参数');

    // 1. 设置响应头
    const headers = {
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream;charset=utf-8',
      'Cache-Control': 'no-cache',
    };
    res.writeHead(200, headers);

    // 2. 客户端版本校验
    if (!handleUpdate(params, res)) return;

    const streaming = +params.noStreaming !== 1;

    const chatGPTResponse = await handleChatGPT(
      req,
      res,
      { ...params, apiKey },
      (processResponse: ChatMessage) => {
        logger.debug(processResponse);
        if (!streaming) return;
        if (processResponse.text) {
          // 3. 逐步返回数据
          res.write(formatReturn(processResponse));
        }
      }
    );

    // 5. 结束
    if (streaming) {
      handleApiDone(res);
      return;
    }
    res.write(JSON.stringify(chatGPTResponse));
    res.end();
  } catch (error: unknown) {
    const err = error as ChatGPTError;
    handleApiError(err, res, { conversationId, parentMessageId });
    handleCrawlerError(err);
  }
}

const router = express.Router();
router.get('/conversation', handleConversation);
router.post('/conversation', handleConversation);

export default router;
