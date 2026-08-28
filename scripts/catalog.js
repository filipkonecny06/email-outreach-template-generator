#!/usr/bin/env node

require('dotenv').config();

const { TemplateCatalogRepository } = require('../src/repositories/templateCatalogRepository');
const { TemplateCatalogService } = require('../src/services/templateCatalogService');

function printHelp() {
  process.stdout.write(
    'Usage: node scripts/catalog.js <validate|list|sync> [category|--apply]\n' +
      'sync is a safe dry-run unless --apply is provided.\n'
  );
}

async function main(args = process.argv.slice(2)) {
  const [command, ...options] = args;
  const service = new TemplateCatalogService({ repository: new TemplateCatalogRepository() });

  if (command === 'validate') {
    const catalog = service.loadAndValidate();
    process.stdout.write(
      `Catalog v${catalog.version} is valid (${catalog.templates.length} templates).\n`
    );
    return;
  }

  if (command === 'list') {
    const templates = service.list({ category: options.join(' ') || undefined });
    for (const template of templates) {
      process.stdout.write(`${template.key}\t${template.category}\t${template.name}\n`);
    }
    return;
  }

  if (command === 'sync') {
    const { Template, sequelize } = require('../src/models');
    try {
      await sequelize.authenticate();
      const summary = await service.sync({ Template, dryRun: !options.includes('--apply') });
      process.stdout.write(`${JSON.stringify(summary)}\n`);
    } finally {
      await sequelize.close();
    }
    return;
  }

  printHelp();
  if (command) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
