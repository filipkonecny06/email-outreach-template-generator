const test = require('node:test');
const assert = require('node:assert/strict');

const { ToastController } = require('../src/public/js/main');

class FakeToastElement {
  constructor() {
    this.className = '';
    this.textContent = '';
    this.removed = false;
  }

  set innerHTML(_value) {
    assert.fail('toast content must not use innerHTML');
  }

  remove() {
    this.removed = true;
  }
}

test('toast messages are inserted as text and removed on schedule', () => {
  const region = {
    children: [],
    appendChild(element) {
      this.children.push(element);
    }
  };
  const scheduled = [];
  const windowObject = { toast: () => 'previous' };
  const controller = ToastController.mount({
    documentObject: {
      getElementById: () => region,
      createElement: () => new FakeToastElement()
    },
    windowObject,
    setTimeoutImpl(callback, duration) {
      scheduled.push({ callback, duration });
      return scheduled.length;
    },
    clearTimeoutImpl() {}
  });

  const element = windowObject.toast('<img src=x onerror=alert(1)>', 'success');

  assert.equal(element.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(element.className, 'toast success');
  assert.deepEqual(region.children, [element]);
  assert.equal(scheduled[0].duration, 2800);
  scheduled[0].callback();
  assert.equal(element.removed, true);
  assert.equal(controller.activeToasts.size, 0);

  controller.destroy();
  assert.equal(windowObject.toast(), 'previous');
});

test('missing toast regions are a safe no-op and destroy restores global state', () => {
  const cleared = [];
  const windowObject = {};
  const controller = ToastController.mount({
    documentObject: {
      getElementById: () => null,
      createElement: () => assert.fail('no element should be created without a region')
    },
    windowObject,
    setTimeoutImpl: () => assert.fail('no timer should be scheduled without a region'),
    clearTimeoutImpl: (timer) => cleared.push(timer)
  });

  assert.equal(windowObject.toast('ignored'), null);
  controller.destroy();
  assert.equal('toast' in windowObject, false);
  assert.deepEqual(cleared, []);
});

test('destroy clears active toast timers and unsupported variants fall back to info', () => {
  const element = new FakeToastElement();
  const cleared = [];
  const controller = new ToastController({
    documentObject: { createElement: () => element },
    windowObject: {},
    region: { appendChild() {} },
    duration: 10,
    setTimeoutImpl: () => 42,
    clearTimeoutImpl: (timer) => cleared.push(timer)
  }).init();

  controller.show(null, 'unsafe-class');
  controller.destroy();

  assert.equal(element.textContent, '');
  assert.equal(element.className, 'toast info');
  assert.deepEqual(cleared, [42]);
  assert.equal(element.removed, true);
});
