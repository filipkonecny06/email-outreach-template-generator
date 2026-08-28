#!/usr/bin/env node

/** Enforces focused coverage floors for browser and authentication modules with higher risk. */
const fs = require('node:fs');
const path = require('node:path');

const TARGETS = Object.freeze({
  'src/controllers/authController.js': Object.freeze({
    lines: 90,
    functions: 90,
    branches: 75
  }),
  'src/public/js/outreach-generator-controller.js': Object.freeze({
    lines: 85,
    functions: 90,
    branches: 65
  }),
  'src/public/js/outreach-api-client.js': Object.freeze({
    lines: 90,
    functions: 100,
    branches: 85
  }),
  'src/public/js/outreach-export-service.js': Object.freeze({
    lines: 90,
    functions: 100,
    branches: 85
  }),
  'src/public/js/outreach-form-view.js': Object.freeze({
    lines: 90,
    functions: 95,
    branches: 85
  }),
  'src/public/js/outreach-template-list-controller.js': Object.freeze({
    lines: 90,
    functions: 95,
    branches: 85
  }),
  'src/public/js/main.js': Object.freeze({ lines: 85, functions: 90, branches: 70 }),
  'src/public/js/history.js': Object.freeze({ lines: 85, functions: 90, branches: 70 })
});

/** Normalizes platform separators before matching absolute coverage-report paths. */
function normalized(filePath) {
  return filePath.split(path.sep).join('/');
}

/**
 * Checks per-file thresholds that complement c8's aggregate project coverage gate.
 *
 * @throws {Error} When a target is absent or below one of its required percentages.
 */
function checkFileCoverage(summaryPath = path.resolve('coverage/coverage-summary.json')) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  for (const [target, minimums] of Object.entries(TARGETS)) {
    const entry = Object.entries(summary).find(([filePath]) =>
      normalized(filePath).endsWith(target)
    );
    if (!entry) throw new Error(`Coverage summary does not contain ${target}.`);

    const [, metrics] = entry;
    const failures = Object.entries(minimums)
      .filter(([metric, minimum]) => metrics[metric].pct < minimum)
      .map(
        ([metric, minimum]) => `${metric} coverage is ${metrics[metric].pct}% (minimum ${minimum}%)`
      );

    if (failures.length > 0) {
      throw new Error(`${target} failed its coverage floor:\n- ${failures.join('\n- ')}`);
    }

    process.stdout.write(
      `${target} coverage passed (${Object.keys(minimums)
        .map((metric) => `${metric} ${metrics[metric].pct}%`)
        .join(', ')}).\n`
    );
  }
}

if (require.main === module) checkFileCoverage();

module.exports = { TARGETS, checkFileCoverage, normalized };
