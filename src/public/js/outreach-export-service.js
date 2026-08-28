/** Exports generated plain text through clipboard, text-file, and CSV browser APIs. */
class OutreachExportService {
  /** @param {object} [options] - Browser adapters and user-notification callback. */
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

  /** Copies one output field and returns whether the browser accepted the operation. */
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

  /** Creates a short-lived object URL and triggers a local browser download. */
  createDownload(contents, type, filename) {
    const blob = new this.Blob([contents], { type });
    const url = this.URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    this.URL.revokeObjectURL(url);
  }

  /** Downloads the current subject and body as readable plain text. */
  downloadText(state) {
    this.createDownload(
      `Subject: ${state.subject}\n\n${state.body}`,
      'text/plain;charset=utf-8',
      'outreach-email.txt'
    );
  }

  /**
   * Quotes one RFC 4180-style cell and neutralizes spreadsheet formula prefixes.
   * CSV is plain text, but spreadsheet applications may execute leading formula characters.
   */
  toCsvCell(value) {
    const text = String(value ?? '');
    const safeText = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  }

  /** Downloads one subject/body record with a stable two-column CSV header. */
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
