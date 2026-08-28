const test = require('node:test');
const assert = require('node:assert/strict');

const logger = require('../src/utils/logger');

test('logger writes structured info, warning, and error records to the expected streams', () => {
  const logLines = [];
  const errorLines = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line) => logLines.push(JSON.parse(line));
  console.error = (line) => errorLines.push(JSON.parse(line));

  try {
    logger.info('Server ready', { port: 3000 });
    logger.warn('Slow request');
    logger.error('Database failed', { code: 'ECONNREFUSED' });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  assert.equal(logLines.length, 2);
  assert.equal(errorLines.length, 1);
  assert.deepEqual(
    logLines.map(({ level, message, meta }) => ({ level, message, meta })),
    [
      { level: 'INFO', message: 'Server ready', meta: { port: 3000 } },
      { level: 'WARN', message: 'Slow request', meta: undefined }
    ]
  );
  assert.deepEqual(
    errorLines.map(({ level, message, meta }) => ({ level, message, meta })),
    [{ level: 'ERROR', message: 'Database failed', meta: { code: 'ECONNREFUSED' } }]
  );
  for (const record of [...logLines, ...errorLines]) {
    assert.equal(new Date(record.timestamp).toISOString(), record.timestamp);
  }
});
