const assert = require('node:assert/strict');

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : force;
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.children = [];
    this.classList = new FakeClassList();
    this.dataset = {};
    this.textContent = '';
    this.clicked = false;
    this.disabled = false;
    this.listeners = new Map();
  }

  set innerHTML(_value) {
    assert.fail('browser output must not be assembled with innerHTML');
  }

  append(...children) {
    this.children.push(...children);
  }

  appendChild(child) {
    this.children.push(child);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  click() {
    this.clicked = true;
  }

  addEventListener(eventName, handler) {
    this.listeners.set(eventName, handler);
  }

  removeEventListener(eventName, handler) {
    if (this.listeners.get(eventName) === handler) this.listeners.delete(eventName);
  }

  emit(eventName, event = {}) {
    return this.listeners.get(eventName)?.({ target: this, ...event });
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

function fakeDocument() {
  return {
    createElement: (tagName) => new FakeElement(tagName),
    createTextNode: (textContent) => ({ textContent })
  };
}

function fieldContainer(name) {
  const input = { disabled: false, required: false };
  return {
    dataset: { outreachField: name },
    hidden: false,
    input,
    querySelector: () => input
  };
}

function findElement(root, tagName) {
  if (!root?.tagName) return undefined;
  if (root.tagName === tagName.toUpperCase()) return root;
  for (const child of root.children) {
    const match = findElement(child, tagName);
    if (match) return match;
  }
  return undefined;
}

module.exports = { FakeClassList, FakeElement, fakeDocument, fieldContainer, findElement };
