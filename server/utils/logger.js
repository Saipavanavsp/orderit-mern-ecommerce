// Small leveled logger. Silent during tests unless LOG_TESTS=true.
const silent = process.env.NODE_ENV === 'test' && process.env.LOG_TESTS !== 'true';
const stamp = () => new Date().toISOString();

export const logger = {
  info: (...args) => !silent && console.log(`[${stamp()}] INFO `, ...args),
  warn: (...args) => !silent && console.warn(`[${stamp()}] WARN `, ...args),
  error: (...args) => !silent && console.error(`[${stamp()}] ERROR`, ...args),
};
