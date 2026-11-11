export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface OperationEnvelope {
  protocolVersion: 1;
  recoveryGeneration: string;
  operationId: string;
  athleteId: string;
  commandType: string;
  rootId: string;
  baseRevision: string;
  occurredOn: string;
  payload: Json;
}

export interface OperationConfirmation {
  operationId: string;
  recoveryGeneration: string;
  revision: string;
  result: Json;
}
