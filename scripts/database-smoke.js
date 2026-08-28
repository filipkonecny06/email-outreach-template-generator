/** Verifies migrated schema invariants, session storage, and catalog synchronization. */
require('dotenv').config({ quiet: true });

const { Op } = require('sequelize');

const HISTORY_PAGINATION_INDEX = 'generation_history_user_created_id';
const HISTORY_PAGINATION_COLUMNS = Object.freeze(['UserId', 'createdAt', 'id']);
const SCHEMA_MODES = new Set(['current', 'legacy']);

/** Parses the expected migration state used by forward and rollback CI checks. */
function parseSchemaMode(args = process.argv.slice(2)) {
  if (args.length === 0) return 'current';
  const match = args.length === 1 ? args[0].match(/^--schema=(current|legacy)$/) : null;
  if (!match) {
    throw new Error('Usage: npm run db:smoke -- [--schema=<current|legacy>]');
  }
  return match[1];
}

/** Normalizes Sequelize's dialect-specific index field representation. */
function indexColumns(index) {
  return (index.fields || []).map((field) =>
    typeof field === 'string' ? field : field.attribute || field.name
  );
}

/** Verifies history-column and pagination-index invariants for one migration state. */
async function verifyHistorySchema(queryInterface, schemaMode) {
  if (!SCHEMA_MODES.has(schemaMode)) throw new Error(`Unknown history schema mode: ${schemaMode}`);

  // These metadata reads are independent and safe to issue concurrently.
  const [columns, indexes] = await Promise.all([
    queryInterface.describeTable('GenerationHistories'),
    queryInterface.showIndex('GenerationHistories')
  ]);
  const hasDeletedAt = Object.hasOwn(columns, 'deletedAt');
  const paginationIndex = indexes.find((index) => index.name === HISTORY_PAGINATION_INDEX);

  if (schemaMode === 'legacy') {
    if (!hasDeletedAt) throw new Error('Legacy history schema must contain deletedAt.');
    if (paginationIndex) {
      throw new Error(`Legacy history schema must not contain ${HISTORY_PAGINATION_INDEX}.`);
    }
    return;
  }

  if (hasDeletedAt) throw new Error('Current history schema must not contain deletedAt.');
  if (!paginationIndex) {
    throw new Error(`Current history schema must contain ${HISTORY_PAGINATION_INDEX}.`);
  }
  const actualColumns = indexColumns(paginationIndex);
  if (actualColumns.join(',') !== HISTORY_PAGINATION_COLUMNS.join(',')) {
    throw new Error(
      `${HISTORY_PAGINATION_INDEX} must cover ${HISTORY_PAGINATION_COLUMNS.join(', ')} in order.`
    );
  }
}

/**
 * Connects to real infrastructure and verifies the application-visible database contract.
 * Resources are closed in finally so a failed assertion cannot leave CI hanging.
 */
async function verifyDatabase({ schemaMode }) {
  if (!SCHEMA_MODES.has(schemaMode)) throw new Error(`Unknown history schema mode: ${schemaMode}`);

  const { createSessionStore } = require('../src/app');
  const { loadConfig } = require('../src/config/environment');
  const { sequelize, Template } = require('../src/models');
  const { TemplateCatalogRepository } = require('../src/repositories/templateCatalogRepository');
  const { TemplateCatalogService } = require('../src/services/templateCatalogService');
  const config = loadConfig();
  const sessionStore = createSessionStore(config);
  const catalog = new TemplateCatalogService({
    repository: new TemplateCatalogRepository()
  }).loadAndValidate();
  const catalogKeys = catalog.templates.map((template) => template.key);

  try {
    await Promise.all([sequelize.authenticate(), sessionStore.onReady()]);
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.describeTable('sessions');
    await verifyHistorySchema(queryInterface, schemaMode);
    const synchronizedTemplates = await Template.count({
      where: { catalogKey: { [Op.in]: catalogKeys } }
    });

    if (synchronizedTemplates !== catalog.templates.length) {
      throw new Error(
        `Expected ${catalog.templates.length} catalog templates, found ${synchronizedTemplates}.`
      );
    }

    process.stdout.write(
      `Database smoke check passed (${schemaMode} history schema, ${synchronizedTemplates} catalog templates, and session storage ready).\n`
    );
  } finally {
    await Promise.allSettled([sessionStore.close(), sequelize.close()]);
  }
}

if (require.main === module) {
  Promise.resolve()
    .then(() => verifyDatabase({ schemaMode: parseSchemaMode() }))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  HISTORY_PAGINATION_COLUMNS,
  HISTORY_PAGINATION_INDEX,
  indexColumns,
  parseSchemaMode,
  verifyDatabase,
  verifyHistorySchema
};
