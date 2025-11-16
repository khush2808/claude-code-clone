import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { inspect } from 'util';

class Logger {
  private logPath: string;

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
      .join(' ');
    
    const logEntry = `[${timestamp}] ${message}\n`;
    appendFileSync(this.logPath, logEntry);
  }
}

export const logger = new Logger();

// Usage:
// logger.log('User:', { id: 1, name: 'John' }, [1, 2, 3]);
// logger.log(someComplexObject);