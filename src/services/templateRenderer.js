const TOKEN_REGEX = /\{([a-zA-Z0-9_]+)\}/g;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTemplate(template, payload = {}) {
  if (!template) return '';
  return template.replace(TOKEN_REGEX, (_, token) => escapeHtml(payload[token] ?? `{${token}}`));
}

function extractTokens(template) {
  const tokens = new Set();
  if (!template) return [];

  for (const match of template.matchAll(TOKEN_REGEX)) {
    tokens.add(match[1]);
  }

  return Array.from(tokens);
}

module.exports = {
  renderTemplate,
  extractTokens,
  escapeHtml
};
