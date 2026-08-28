const test = require('node:test');
const assert = require('node:assert/strict');

const { HistoryClipboardController } = require('../src/public/js/history');

function createDocument(page = {}) {
  const listeners = new Map();
  return {
    listeners,
    querySelector: () => page,
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener(name, listener) {
      if (listeners.get(name) === listener) listeners.delete(name);
    }
  };
}

function createCopyTarget(subject, body) {
  const card = {
    querySelector(selector) {
      if (selector === '[data-history-subject]') return { textContent: subject };
      if (selector === '[data-history-body]') return { textContent: body };
      return null;
    }
  };
  const button = {
    disabled: false,
    closest: (selector) => (selector === '.history-card' ? card : null)
  };
  const target = {
    closest: (selector) => (selector === '.copy-history' ? button : null)
  };
  return { button, target };
}

test('mount skips non-history pages', () => {
  const documentObject = createDocument(null);

  assert.equal(HistoryClipboardController.collectElements(documentObject), null);
  assert.equal(HistoryClipboardController.mount({ documentObject, windowObject: {} }), null);
  assert.equal(documentObject.listeners.size, 0);
});

test('delegated clicks copy the exact history payload and report success', async () => {
  const documentObject = createDocument();
  const clipboardWrites = [];
  const notifications = [];
  const { button, target } = createCopyTarget('<b>Literal subject</b>', 'Line one\nLine two');
  const controller = HistoryClipboardController.mount({
    documentObject,
    windowObject: {},
    clipboard: { writeText: async (value) => clipboardWrites.push(value) },
    notify: (message, type) => notifications.push({ message, type })
  });

  assert.equal(controller.init(), controller);
  assert.equal(documentObject.listeners.size, 1);
  assert.equal(await documentObject.listeners.get('click')({ target }), true);
  assert.deepEqual(clipboardWrites, ['Subject: <b>Literal subject</b>\n\nLine one\nLine two']);
  assert.deepEqual(notifications, [{ message: 'History entry copied.', type: 'success' }]);
  assert.equal(button.disabled, false);

  controller.destroy();
  controller.destroy();
  assert.equal(documentObject.listeners.size, 0);
});

test('irrelevant clicks and malformed copy controls are ignored', async () => {
  const controller = new HistoryClipboardController({
    documentObject: createDocument(),
    windowObject: {},
    elements: { page: {} }
  });

  assert.equal(await controller.handleClick({ target: {} }), false);
  assert.equal(
    await controller.handleClick({
      target: { closest: () => ({ closest: () => null }) }
    }),
    false
  );
});

test('clipboard failures restore the button and show a stable error', async () => {
  const notifications = [];
  const { button, target } = createCopyTarget('', 'Draft body');
  const controller = new HistoryClipboardController({
    documentObject: createDocument(),
    windowObject: {},
    elements: { page: {} },
    clipboard: {
      writeText: async () => {
        throw new Error('permission denied');
      }
    },
    notify: (message, type) => notifications.push({ message, type })
  });

  assert.equal(await controller.handleClick({ target }), false);
  assert.equal(button.disabled, false);
  assert.deepEqual(notifications, [
    { message: 'Could not copy the history entry.', type: 'error' }
  ]);
});

test('missing clipboard support reports an error without mutating the button', async () => {
  const notifications = [];
  const { button, target } = createCopyTarget('Subject', 'Body');
  const controller = new HistoryClipboardController({
    documentObject: createDocument(),
    windowObject: {},
    elements: { page: {} },
    notify: (message, type) => notifications.push({ message, type })
  });

  assert.equal(await controller.handleClick({ target }), false);
  assert.equal(button.disabled, false);
  assert.deepEqual(notifications, [{ message: 'Clipboard is unavailable.', type: 'error' }]);
});

test('notifications resolve the global toast after deferred scripts finish loading', async () => {
  const notifications = [];
  const windowObject = {};
  const { target } = createCopyTarget('Subject', 'Body');
  const controller = new HistoryClipboardController({
    documentObject: createDocument(),
    windowObject,
    elements: { page: {} },
    clipboard: { writeText: async () => {} }
  });

  windowObject.toast = (message, type) => notifications.push({ message, type });

  assert.equal(await controller.handleClick({ target }), true);
  assert.deepEqual(notifications, [{ message: 'History entry copied.', type: 'success' }]);
});
