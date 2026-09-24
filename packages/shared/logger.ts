import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname', // Clean up output
      translateTime: 'SYS:standard',
    }
  } : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
  // Redact potentially sensitive keys or large objects
  redact: {
    paths: ['req.headers.authorization', 'req.body.password', 'res.headers', '*.data', 'data'],
    remove: true
  }
})
