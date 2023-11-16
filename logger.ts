import { AsyncLocalStorage } from 'async_hooks';
import pino from 'pino';
import { v4 as uuid } from 'uuid';
import express from 'express';

const context = new AsyncLocalStorage<Map<string, any>>();

const gcpLoggingOptions: pino.LoggerOptions = {
  base: undefined,
  messageKey: 'message',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { severity: label.toUpperCase() };
    },
  },
};

const _logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...gcpLoggingOptions,
});

export const logger = new Proxy(_logger, {
  get(target, prop, receiver) {
    target = context.getStore()?.get('logger') || target;
    return Reflect.get(target, prop, receiver);
  }
});

export const loggerMiddleware: express.RequestHandler = (_req, _res, next) => {
  const id = _req.headers['x-request-id'] ?? uuid();
  _res.setHeader('X-Request-Id', id);

  const child = _logger.child({ id });
  const store = new Map();
  store.set('logger', child);

  const req = pino.stdSerializers.req(_req);
  child.info({ req }, 'Request started');

  const startTime = Date.now();
  _res.on('close', () => {
    const res = pino.stdSerializers.res(_res);
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;
    if (statusCode >= 400 && statusCode < 500) {
      child.warn({ req, res, responseTime }, 'Request failed');
    } else if (statusCode >= 500) {
      child.error({ req, res, responseTime }, 'Request failed');
    } else {
      child.info({ req, res, responseTime }, 'Request completed');
    }
  });

  return context.run(store, next);
};
