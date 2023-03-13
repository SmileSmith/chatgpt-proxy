#!/usr/bin/env node

/**
 * Module dependencies.
 */

import debugAPI from 'debug';
import http from 'http';
import app from '../app';

const debug = debugAPI('chatgpt-proxy-service:server');

/**
 * Get port from environment and store in Express.
 */
/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
  const port = parseInt(val, 10);

  if (!port) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}
/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '8000');
app.set('port', port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = `${typeof port === 'string' ? 'Pipe ' : 'Port '}${port}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  const addr = server.address();
  const bind = `${typeof port === 'string' ? 'Pipe ' : 'Port '}${port}`;
  debug(`Listening on ${addr}${bind}`);
}

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
