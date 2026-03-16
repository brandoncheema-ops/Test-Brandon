import pino from 'pino';

// Logger is initialized lazily to avoid circular dependency with env
let _logger: pino.Logger | null = null;

export function getLogger(name?: string): pino.Logger {
  if (!_logger) {
    const level = process.env.LOG_LEVEL || 'info';
    const isDev = process.env.NODE_ENV !== 'production';

    _logger = pino({
      level,
      ...(isDev && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
      serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
    });
  }

  return name ? _logger.child({ component: name }) : _logger;
}
