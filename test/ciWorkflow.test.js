const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');
const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
const dockerignorePath = path.join(__dirname, '..', '.dockerignore');

function jobSource(workflow, jobName) {
  const start = workflow.indexOf(`  ${jobName}:`);
  assert.notEqual(start, -1, `${jobName} job must exist`);
  const remainingJobs = workflow.slice(start + `  ${jobName}:`.length);
  const nextJobOffset = remainingJobs.search(/\n {2}[a-z][a-z0-9-]*:\r?\n/);
  const end =
    nextJobOffset === -1 ? workflow.length : start + `  ${jobName}:`.length + nextJobOffset;
  return workflow.slice(start, end);
}

test('container CI migrates MySQL and boots the production image before probing health', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const containerJob = jobSource(workflow, 'container-build');

  assert.match(containerJob, /image: mysql:8\.4\.11@sha256:[a-f0-9]{64}/);
  assert.match(containerJob, /DB_NAME: outreach_generator/);
  assert.match(containerJob, /DB_SSL: 'false'/);
  assert.match(containerJob, /PORT: 3101/);
  assert.match(
    containerJob,
    /docker run --rm --network host[\s\S]*--env DB_NAME[\s\S]*--env DB_SSL[\s\S]*outreach-ops-migration:test/
  );
  assert.match(
    containerJob,
    /docker run --detach --init[\s\S]*--env DB_NAME[\s\S]*--env DB_SSL[\s\S]*outreach-ops:test/
  );
  assert.match(containerJob, /trap cleanup EXIT/);
  assert.match(containerJob, /for _attempt in \{1\.\.30\}/);
  assert.match(containerJob, /http:\/\/127\.0\.0\.1:3101\/healthz/);
});

test('migration CI verifies both history schema states in sequence', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const migrationJob = jobSource(workflow, 'mysql-migrations');
  const schemaChecks = [...migrationJob.matchAll(/db:smoke -- --schema=(current|legacy)/g)].map(
    (match) => match[1]
  );

  assert.deepEqual(schemaChecks, ['current', 'legacy', 'current']);
  assert.equal((migrationJob.match(/db:migrate:undo/g) || []).length, 2);
});

test('Docker health checks honor the configured port while CI probes its explicit port', () => {
  const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const containerJob = jobSource(workflow, 'container-build');

  assert.match(dockerfile, /process\.env\.PORT \|\| 3000/);
  assert.doesNotMatch(dockerfile, /127\.0\.0\.1:3000\/healthz/);
  assert.match(containerJob, /PORT: 3101/);
  assert.match(containerJob, /127\.0\.0\.1:3101\/healthz/);
});

test('MySQL images use an immutable version and digest', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const compose = fs.readFileSync(path.join(__dirname, '..', 'docker-compose.yml'), 'utf8');
  const pinnedImage = /mysql:8\.4\.11@sha256:[a-f0-9]{64}/g;

  assert.equal((workflow.match(pinnedImage) || []).length, 2);
  assert.equal((compose.match(pinnedImage) || []).length, 1);
  assert.doesNotMatch(workflow, /image: mysql:8\.4(?:\s|$)/m);
});

test('Docker build context excludes local credentials and development artifacts', () => {
  const patterns = new Set(
    fs
      .readFileSync(dockerignorePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );

  for (const expected of [
    '.git',
    '.env',
    '.env.*',
    '!.env.example',
    'node_modules',
    'coverage',
    'test',
    'test-support',
    '*.log'
  ]) {
    assert.ok(patterns.has(expected), `${expected} must be covered by .dockerignore`);
  }
});
