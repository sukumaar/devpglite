import type { TestContext } from 'node:test';
import { format } from 'node:util';
import { logger } from '../../src/logger.js';
import { LOG_LEVELS } from '../constants.js';

// Capture messages without terminal formatting; the test runner restores each method.
export function captureLogs(context: TestContext) {
  const messages: string[] = [];
  for (const level of LOG_LEVELS) {
    context.mock.method(logger, level, (...args: unknown[]) => {
      messages.push(format(...args));
    });
  }
  return messages;
}
