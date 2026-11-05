/**
 * Atlas business core: metamodel, YAML format, validation and generators.
 * See docs/02-metamodel.md and docs/03-spec-format.md. No UI, database or network dependency (ADR 0001).
 */
export { FORMAT_VERSION } from "./format";
export { isValidId } from "./ids";
export { loadProject, type Loaded, type Project, type SpecFile } from "./spec/load";
export * as schemas from "./spec/schemas";
export { FUNCTIONS } from "./types/functions";
export { formatLogicalType, isImplicitlyAssignable, parseLogicalType, type LogicalType } from "./types/logical-types";
export type { Issue, Severity } from "./validate/issues";
export { validateProject, type ValidationResult } from "./validate/validate";
export { generateDbt, GenerationError, type GeneratedFile } from "./generate/dbt";
export { generateDocs } from "./generate/docs";
export { datasetToYaml, DICTIONARY_COLUMNS, importDictionary, type DictionaryImportReport } from "./import/dictionary";
export { DIALECTS, logicalTypeFor, type Dialect } from "./import/native-types";
export { diffProjects, type ObjectChange } from "./diff/diff";
