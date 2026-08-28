const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const browserDirectory = path.join(__dirname, '..', 'src', 'public', 'js');
const moduleFiles = [
  'outreach-api-client.js',
  'outreach-form-view.js',
  'outreach-template-list-controller.js',
  'outreach-export-service.js',
  'outreach-generator-controller.js'
];

test('generator browser classes register under one namespace in dependency order', () => {
  const context = vm.createContext({
    AbortController,
    Blob,
    FormData,
    URL,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
    window: {
      document: { querySelector: () => null }
    }
  });
  context.globalThis = context;

  for (const filename of moduleFiles) {
    vm.runInContext(fs.readFileSync(path.join(browserDirectory, filename), 'utf8'), context, {
      filename
    });
  }
  vm.runInContext(fs.readFileSync(path.join(browserDirectory, 'generator.js'), 'utf8'), context, {
    filename: 'generator.js'
  });

  assert.deepEqual(Object.keys(context.window.OutreachOps).sort(), [
    'OutreachApiClient',
    'OutreachExportService',
    'OutreachFormView',
    'OutreachGeneratorController',
    'OutreachTemplateListController',
    'generator'
  ]);
  assert.equal(context.window.OutreachOps.generator, null);
  assert.equal(context.window.OutreachGeneratorController, undefined);
  assert.equal(context.window.outreachGenerator, undefined);
});

test('generator view loads browser collaborators before the orchestrator and bootstrap', () => {
  const view = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'generator.ejs'), 'utf8');
  const positions = [...moduleFiles, 'generator.js'].map((filename) =>
    view.indexOf(`/js/${filename}`)
  );

  assert.equal(
    positions.every((position) => position >= 0),
    true
  );
  assert.deepEqual(
    positions,
    [...positions].sort((left, right) => left - right)
  );
});
