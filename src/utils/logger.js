function write(level, message, meta = null) {
  const timestamp = new Date().toISOString();
  const line = JSON.stringify({ timestamp, level, message, ...(meta ? { meta } : {}) });
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  info: (message, meta) => write('INFO', message, meta),
  warn: (message, meta) => write('WARN', message, meta),
  error: (message, meta) => write('ERROR', message, meta)
};
