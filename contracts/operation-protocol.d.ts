/** Транспортные типы общие для API и браузера и не содержат серверных зависимостей. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/**
 * Подготовленная команда сохраняется без изменений до определённого исхода.
 * Новый UUID при сетевом повторе сделал бы уже выполненное изменение новой операцией.
 */
export type OperationEnvelope = {
  protocolVersion: 1;
  recoveryGeneration: string;
  operationId: string;
  athleteId: string;
  commandType: string;
  rootId: string;
  baseRevision: string;
  occurredOn: string;
  payload: Json;
};

export type OperationConfirmation = {
  operationId: string;
  recoveryGeneration: string;
  revision: string;
  result: Json;
};
