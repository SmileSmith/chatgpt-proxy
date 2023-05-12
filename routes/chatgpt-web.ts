import express from 'express';
import Logger from 'log4js';
import { ChatMessage } from 'chatgpt';
import * as dotenv from 'dotenv';
import { handleChatGPT } from './api';

dotenv.config();

const router = express.Router();
const logger = Logger.getLogger('chatgpt');
logger.level = process.env.LOG_LEVEL || 'debug';

const MODEL = 'ChatGPTUnofficialProxyAPI';

router.post('/session', async (req, res) => {
  res.send({
    status: 'Success',
    message: '',
    data: { auth: true, model: MODEL },
  });
});

router.post('/config', async (req, res) => {
  try {
    res.send({
      type: 'Success',
      data: {
        apiModel: MODEL,
        reverseProxy: '-',
        timeoutMs: '-',
        socksProxy: '-',
        httpsProxy: '-',
        usage: '？？？',
      },
    });
  } catch (error) {
    res.send(error);
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string };
    if (!token) throw new Error('Secret key is empty');

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
  const { parentMessageId, conversationId } = options;

  try {
    if (!message) throw new Error('请传入prompt参数');

    // 1. 设置响应头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'authorization, Content-Type'
    );
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Content-type', 'application/octet-stream');

    let firstChunk = true;

    const chatGPTResponse = await handleChatGPT(
      req,
      res,
      { message, parentMessageId, conversationId },
      (processResponse: ChatMessage) => {
        logger.debug(processResponse);
        res.write(
          firstChunk
            ? JSON.stringify(processResponse)
            : `\n${JSON.stringify(processResponse)}`
        );
        firstChunk = false;
      }
    );
    res.write(JSON.stringify(chatGPTResponse));
  } catch (error: unknown) {
    res.write(JSON.stringify(error));
  } finally {
    res.end();
  }
});

export default router;
