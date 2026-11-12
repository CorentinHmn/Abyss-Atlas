/**
 * Atlas business core: metamodel, YAML format, validation and generators.
 * See docs/02-metamodel.md and docs/03-spec-format.md. No UI, database or network dependency (ADR 0001).
 */
export { FORMAT_VERSION } from "./format";
export { isValidId } from "./ids";
export { loadProject, type Loaded, type Project, type SpecFile } from "./spec/load";
export { canonicalJson, contentHash } from "./spec/canonical";
export { specKey, specPath, specToFile } from "./spec/serialize";
export { checkSpecFile, lineOf, splitPath, type EditIssue } from "./spec/edit";
export type { SpecKind } from "./spec/schemas";
export * as schemas from "./spec/schemas";
export { FUNCTIONS } from "./types/functions";
export { formatLogicalType, isComparable, isImplicitlyAssignable, parseLogicalType, type LogicalType } from "./types/logical-types";
export type { Issue, Severity } from "./validate/issues";
export { validateProject, type ValidationResult } from "./validate/validate";
export { generateDbt, GenerationError, type GeneratedFile } from "./generate/dbt";
export { generateDocs } from "./generate/docs";
export { datasetIdFor, datasetToYaml, DICTIONARY_COLUMNS, importDictionary, type DictionaryImportReport } from "./import/dictionary";
export { CATALOG_QUERIES, type CatalogQueryDialect } from "./import/catalog-queries";
export { parseCsv } from "./import/csv";
export { DIALECTS, logicalTypeFor, type Dialect } from "./import/native-types";
export { diffObjects, diffProjects, type FieldChange, type ObjectChange } from "./diff/diff";
