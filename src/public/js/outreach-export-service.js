class OutreachExportService {
  constructor({
    documentObject = globalThis.document,
    windowObject = globalThis.window,
    BlobImpl = globalThis.Blob,
    URLObject = globalThis.URL,
    notify
  } = {}) {
    this.document = documentObject;
    this.clipboard = windowObject?.navigator?.clipboard;
    this.Blob = BlobImpl;
    this.URL = URLObject;
    this.notify = notify;
  }

  async copy(field, value) {
    if (!this.clipboard?.writeText) {
      this.notify('Clipboard is unavailable.', 'error');
      return false;
    }

    try {
      await this.clipboard.writeText(value || '');
      this.notify(field === 'subject' ? 'Subject copied.' : 'Body copied.', 'success');
      return true;
    } catch {
      this.notify(`Could not copy the ${field}.`, 'error');
      return false;
    }
  }

  createDownload(contents, type, filename) {
    const blob = new this.Blob([contents], { type });
    const url = this.URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    this.URL.revokeObjectURL(url);
  }

  downloadText(state) {
    this.createDownload(
      `Subject: ${state.subject}\n\n${state.body}`,
      'text/plain;charset=utf-8',
      'outreach-email.txt'
    );
  }

  toCsvCell(value) {
    const text = String(value ?? '');
    const safeText = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  }

  downloadCsv(state) {
    const csv =
      ['subject', 'body'].join(',') +
      '\n' +
      [state.subject, state.body].map((value) => this.toCsvCell(value)).join(',');
    this.createDownload(csv, 'text/csv;charset=utf-8', 'outreach-email.csv');
  }
}

if (typeof window !== 'undefined') {
  window.OutreachOps = window.OutreachOps || {};
  window.OutreachOps.OutreachExportService = OutreachExportService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OutreachExportService };
}
