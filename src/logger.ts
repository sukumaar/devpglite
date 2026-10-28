import signale from 'signale';
import { LOGGER_CONFIG, LOGGER_OPTIONS } from './constants.js';

// Send status messages to stderr so command output stays usable by scripts.
export const logger = new signale.Signale(LOGGER_OPTIONS);
logger.config(LOGGER_CONFIG);
