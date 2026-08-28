/** Reads the version-controlled catalog and its validation schema from disk. */
const fs = require('node:fs');
const path = require('node:path');

class TemplateCatalogRepository {
  constructor({
    catalogPath = path.resolve(__dirname, '../../data/template-catalog.json'),
    schemaPath = path.resolve(__dirname, '../../data/template-catalog.schema.json'),
    fileSystem = fs
  } = {}) {
    this.catalogPath = catalogPath;
    this.schemaPath = schemaPath;
    this.fileSystem = fileSystem;
  }

  readCatalog() {
    return this.#readJson(this.catalogPath);
  }

  readSchema() {
    return this.#readJson(this.schemaPath);
  }

  #readJson(filePath) {
    try {
      // Reads are synchronous by design: this adapter runs during startup or short-lived CLI work.
      return JSON.parse(this.fileSystem.readFileSync(filePath, 'utf8'));
    } catch (error) {
      error.message = `Unable to read ${filePath}: ${error.message}`;
      throw error;
    }
  }
}

module.exports = { TemplateCatalogRepository };
