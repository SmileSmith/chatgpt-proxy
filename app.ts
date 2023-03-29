import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import logger from 'morgan';
import * as dotenv from 'dotenv';
import indexRouter from './routes/index';
import apiRouter from './routes/api';
import sysRouter from './routes/sys';

dotenv.config();

logger.format('dev', '[dev] :method :url :status - :res[content-length] bytes - :response-time ms');

const app = express();
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.use('/', indexRouter);
app.use('/api', apiRouter);
app.use('/sys', sysRouter);

export default app;
