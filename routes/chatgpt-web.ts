import express from 'express';
import Logger from 'log4js';
import { ChatMessage } from 'chatgpt';
import * as dotenv from 'dotenv';
import { handleChatGPT } from './api';

dotenv.config();

const MODEL = 'ChatGPTUnofficialProxyAPI';

const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';

const router = express.Router();

router.post('/session', async (_req, res) => {
  res.send({
    status: 'Success',
    message: '',
    data: { auth: true, model: MODEL },
  });
});

router.post('/config', async (_req, res) => {
  const responseData = {
    type: 'Success',
    data: {
      apiModel: MODEL,
      reverseProxy: '-',
      timeoutMs: '-',
      socksProxy: '-',
      httpsProxy: '-',
      usage: '？？？',
    },
  };
  res.send(responseData);
});

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string };
    if (!token) {
      throw new Error('Secret key is empty');
    }

    if (process.env.CHATGPT_WEB_AUTH_SECRET_KEY !== token) {
      throw new Error('密钥无效 | Secret key is invalid');
    }

    res.send({ status: 'Success', message: 'Verify successfully', data: null });
  } catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null });
  }
});

router.post('/chat-process', async (req, res) => {
  const params = { ...req.body, ...req.query } as any;
  const { prompt: message, options = {} } = params;
  const { parentMessageId, conversationId, model } = options;

  try {
    if (!message) throw new Error('请传入prompt参数');

    // 设置响应头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, Content-Type');
    res.setHeader('Content-type', 'application/octet-stream');

    let isFirstChunk = true;
    await handleChatGPT(
      req,
      res,
      {
        message,
        parentMessageId,
        conversationId,
        model,
      },
      (processResponse: ChatMessage) => {
        logger.debug(processResponse);

        res.write(
          isFirstChunk
            ? JSON.stringify(processResponse)
            : `\n${JSON.stringify(processResponse)}`
        );

        isFirstChunk = false;
      }
    );
  } catch (error: unknown) {
    res.write(JSON.stringify(error));
  } finally {
    res.end();
  }
});

export default router;
