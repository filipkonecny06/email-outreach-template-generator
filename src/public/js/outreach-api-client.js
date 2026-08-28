class OutreachApiClient {
  constructor({ fetchImpl = globalThis.fetch, csrfToken = '' } = {}) {
    this.fetch = fetchImpl;
    this.csrfToken = csrfToken;
  }

  errorMessage(data, fallback) {
    const details = data?.error?.details;
    const fieldErrors = Array.isArray(details)
      ? details
      : Array.isArray(details?.fields)
        ? details.fields
        : [];
    const fieldMessage = fieldErrors
      .map((error) => error?.message || error?.msg)
      .filter(Boolean)
      .join(' ');
    if (fieldMessage) return fieldMessage;
    return data?.error?.message || data?.message || fallback;
  }

  async request(path, { method = 'GET', payload, signal } = {}, fallback = 'Request failed.') {
    const hasPayload = payload !== undefined;
    const response = await this.fetch(path, {
      method,
      headers: {
        ...(hasPayload ? { 'Content-Type': 'application/json' } : {}),
        ...(method === 'GET' ? {} : { 'X-CSRF-Token': this.csrfToken })
      },
      ...(hasPayload ? { body: JSON.stringify(payload) } : {}),
      ...(signal ? { signal } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(this.errorMessage(data, fallback));
    return data;
  }

  preview(payload, { signal } = {}) {
    return this.request(
      '/api/preview',
      { method: 'POST', payload, signal },
      'Failed to generate preview.'
    );
  }

  listTemplates(filters, { signal } = {}) {
    const query = new URLSearchParams({
      search: filters.search,
      category: filters.category,
      favorites: filters.favorites ? 'true' : 'false'
    });
    return this.request(
      `/api/templates?${query.toString()}`,
      { signal },
      'Failed to refresh templates.'
    );
  }

  toggleFavorite(templateId) {
    return this.request(
      `/api/favorite/${templateId}`,
      { method: 'POST' },
      'Favorite action failed.'
    );
  }

  saveHistory(payload) {
    return this.request('/api/history', { method: 'POST', payload }, 'Failed to save history.');
  }
}

if (typeof window !== 'undefined') {
  window.OutreachOps = window.OutreachOps || {};
  window.OutreachOps.OutreachApiClient = OutreachApiClient;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OutreachApiClient };
}
