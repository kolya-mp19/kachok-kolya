import { createHash } from 'node:crypto';
import { OperationError } from './operation.error.js';
import type { Json, OperationEnvelope } from './protocol.js';

const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENVELOPE_FIELDS = new Set([
  'protocolVersion',
  'recoveryGeneration',
  'operationId',
  'athleteId',
  'commandType',
  'rootId',
  'baseRevision',
  'occurredOn',
  'payload',
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Отсекает циклы, классы и разреженные массивы без однозначного представления JSON. */
export function isJson(value: unknown, ancestors = new Set<object>()): value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (typeof value !== 'object' || ancestors.has(value)) {
    return false;
  }

  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) {
      return false;
    }
  } else if (Object.getPrototypeOf(value) !== Object.prototype) {
    return false;
  }

  ancestors.add(value);
  const valid = Object.values(value).every((item) => isJson(item, ancestors));
  ancestors.delete(value);

  return valid;
}

export function isOperationId(value: unknown): value is string {
  return typeof value === 'string' && OPERATION_ID_PATTERN.test(value);
}

function readRequiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OperationError('INVALID_OPERATION');
  }

  return value;
}

function freezeRecursively(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeRecursively);
    Object.freeze(value);
  }
}

/**
 * Фиксирует собственный неизменяемый снимок до первого await: ни вызывающий код,
 * ни обработчик команды не должны менять содержимое после вычисления хеша.
 */
export function parseOperationEnvelope(input: unknown): OperationEnvelope {
  if (!isRecord(input) || input.protocolVersion !== 1) {
    throw new OperationError('INVALID_OPERATION');
  }

  if (Object.keys(input).some((field) => !ENVELOPE_FIELDS.has(field))) {
    throw new OperationError('INVALID_OPERATION');
  }

  if (!isOperationId(input.operationId) || !isJson(input.payload)) {
    throw new OperationError('INVALID_OPERATION');
  }

  if (input.recoveryGeneration !== undefined && typeof input.recoveryGeneration !== 'string') {
    throw new OperationError('INVALID_OPERATION');
  }

  const command: OperationEnvelope = {
    protocolVersion: 1,
    // Старый клиент без поколения получает тот же отказ восстановления, что и клиент
    // с устаревшим поколением; отсутствие поля не разрешает поиск прежней квитанции.
    recoveryGeneration: input.recoveryGeneration ?? '',
    operationId: input.operationId,
    athleteId: readRequiredString(input.athleteId),
    commandType: readRequiredString(input.commandType),
    rootId: readRequiredString(input.rootId),
    baseRevision: readRequiredString(input.baseRevision),
    occurredOn: readRequiredString(input.occurredOn),
    payload: structuredClone(input.payload),
  };

  freezeRecursively(command);

  return command;
}

function canonicalJson(value: Json): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }

  const properties = Object.keys(value)
    .sort()
    .map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key]));

  return '{' + properties.join(',') + '}';
}

/** Порядок ключей JSON не меняет идентичность команды при сетевом повторе. */
export function hashOperation(command: OperationEnvelope): string {
  return createHash('sha256')
    .update(canonicalJson({ ...command }))
    .digest('hex');
}
