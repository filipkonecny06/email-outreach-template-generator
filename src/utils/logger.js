const fs = require('fs');
const path = require('path');

function ensureLogDir() {
  const dir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function write(level, message, meta = null) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`;
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }

  const logDir = ensureLogDir();
  fs.appendFileSync(path.join(logDir, 'app.log'), `${line}\n`, 'utf8');
}

module.exports = {
  info: (message, meta) => write('INFO', message, meta),
  warn: (message, meta) => write('WARN', message, meta),
  error: (message, meta) => write('ERROR', message, meta)
};
