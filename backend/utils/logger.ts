import winston from 'winston';
import Transport from 'winston-transport';

class NullTransport extends Transport {
  log(info: any, callback: () => void) {
    setImmediate(() => {
      this.emit('logged', info);
    });
    callback();
  }
}

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL || 'debug'), // Allow log level to be set via LOG_LEVEL env var, default to 'debug'
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: process.env.NODE_ENV === 'test'
    ? [new NullTransport()] // Use NullTransport in test environment
    : [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
      ]
});
