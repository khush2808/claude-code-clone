import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { inspect } from 'util';

class Logger {
  private logPath: string;
  private readonly sensitiveValuePattern =
    /((?:api[_-]?key|authorization|token|password|secret)\s*[:=]\s*)([^\s,}\]]+)/gi;

  constructor(filename: string = 'logs.txt') {
    const logsDir = join(process.cwd(), 'logs');
    
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    
    this.logPath = join(logsDir, filename);
  }

  log(...args: any[]): void {
    const timestamp = new Date().toISOString();
    
    // Convert each argument to string like console.log does
    const message = args
      .map(arg => 
        typeof arg === 'string' 
          ? arg 
          : inspect(arg, { depth: null, colors: false })
      )
      .join(' ')
      .replace(this.sensitiveValuePattern, '$1[REDACTED]');
    
    const logEntry = `[${timestamp}] ${message}\n`;
    appendFileSync(this.logPath, logEntry);
  }

  error(context: string, error: unknown, details?: Record<string, unknown>): void {
    const normalizedError =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            cause: (error as Error & { cause?: unknown }).cause,
          }
        : { value: error };

    this.log('ERROR', context, {
      ...details,
      error: normalizedError,
    });
  }
}

export const logger = new Logger();

// Usage:
// logger.log('User:', { id: 1, name: 'John' }, [1, 2, 3]);
// logger.log(someComplexObject);
