const test = require('node:test');
const assert = require('node:assert/strict');

const { OutreachExportService } = require('../src/public/js/outreach-export-service');
const { FakeElement } = require('../test-support/browser');

function createService({ clipboard } = {}) {
  const notifications = [];
  const revoked = [];
  const anchors = [];
  class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.type = options.type;
    }
  }
  const service = new OutreachExportService({
    documentObject: {
      createElement() {
        const anchor = new FakeElement('a');
        anchors.push(anchor);
        return anchor;
      }
    },
    windowObject: { navigator: clipboard === undefined ? {} : { clipboard } },
    BlobImpl: FakeBlob,
    URLObject: {
      createObjectURL: (blob) => `blob:${blob.type}`,
      revokeObjectURL: (url) => revoked.push(url)
    },
    notify: (message, type) => notifications.push({ message, type })
  });
  return { service, notifications, revoked, anchors };
}

test('clipboard copies subject and body and handles unavailable or rejected access', async () => {
  const copied = [];
  const success = createService({ clipboard: { writeText: async (value) => copied.push(value) } });
  assert.equal(await success.service.copy('subject', 'Subject'), true);
  assert.equal(await success.service.copy('body', ''), true);
  assert.deepEqual(copied, ['Subject', '']);
  assert.deepEqual(success.notifications, [
    { message: 'Subject copied.', type: 'success' },
    { message: 'Body copied.', type: 'success' }
  ]);

  const unavailable = createService();
  assert.equal(await unavailable.service.copy('subject', 'Subject'), false);
  assert.deepEqual(unavailable.notifications, [
    { message: 'Clipboard is unavailable.', type: 'error' }
  ]);

  const rejected = createService({
    clipboard: {
      writeText: async () => {
        throw new Error('permission denied');
      }
    }
  });
  assert.equal(await rejected.service.copy('body', 'Body'), false);
  assert.deepEqual(rejected.notifications, [
    { message: 'Could not copy the body.', type: 'error' }
  ]);
});

test('download methods create and immediately revoke text and CSV object URLs', () => {
  const { service, revoked, anchors } = createService();
  const state = { subject: 'Subject', body: 'Body' };

  service.downloadText(state);
  service.downloadCsv(state);

  assert.equal(anchors[0].download, 'outreach-email.txt');
  assert.equal(anchors[0].href, 'blob:text/plain;charset=utf-8');
  assert.equal(anchors[0].clicked, true);
  assert.equal(anchors[1].download, 'outreach-email.csv');
  assert.equal(anchors[1].clicked, true);
  assert.deepEqual(revoked, ['blob:text/plain;charset=utf-8', 'blob:text/csv;charset=utf-8']);
});

test('CSV encoding escapes quotes and neutralizes spreadsheet formula prefixes', () => {
  const { service } = createService();
  for (const value of [
    '=SUM(A1:A2)',
    '+cmd|calc',
    '-1+2',
    '@SUM(A1:A2)',
    '\t=SUM(A1:A2)',
    '\r=SUM(A1:A2)',
    '\n=SUM(A1:A2)'
  ]) {
    assert.equal(service.toCsvCell(value), `"'${value}"`);
  }
  assert.equal(service.toCsvCell(null), '""');
  assert.equal(service.toCsvCell('ordinary text'), '"ordinary text"');
  assert.equal(service.toCsvCell('She said "hello"'), '"She said ""hello"""');
});
