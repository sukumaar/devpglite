import { format } from 'node:util';
import { type TestContext, vi } from 'vitest';
import { logger } from '../../src/logger.js';
import { LOG_LEVELS } from '../constants.js';

// Capture messages without terminal formatting; the test runner restores each method.
export function captureLogs(context: TestContext) {
  const logMessages: string[] = [];
  for (const level of LOG_LEVELS) {
    const spy = vi.spyOn(logger, level).mockImplementation((...args: unknown[]) => {
      logMessages.push(format(...args));
    });
    context.onTestFinished(() => spy.mockRestore());
  }
  return logMessages;
}
