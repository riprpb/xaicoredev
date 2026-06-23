import type { KernelAuditWriter } from '@/platform/audit/contracts';
import type { KernelConfigurationReader } from '@/platform/config/contracts';
import type { KernelEventPublisher } from '@/platform/events/contracts';
import type { KernelRequestContext } from '@/platform/kernel/context';
import type {
  KernelPermissionEngine,
  PermissionDecision,
  PermissionRequest,
} from '@/platform/permissions/contracts';

export interface KernelOperationRequest<TPayload = unknown> {
  context: KernelRequestContext;
  target: string;
  capability: string;
  action: string;
  payload?: TPayload;
}

export interface KernelOperationResult<TResult = unknown> {
  requestId: string;
  correlationId: string;
  accepted: boolean;
  permission: PermissionDecision;
  result?: TResult;
  message?: string;
}

export const KERNEL_READ_ACTIONS = [
  'read',
  'list',
  'inspect',
  'summarize',
  'analyze',
  'report',
] as const;

export type KernelReadAction = (typeof KERNEL_READ_ACTIONS)[number];

export interface KernelReadRequest {
  context: KernelRequestContext;
  target: string;
  capability: string;
  action: KernelReadAction;
  query?: Readonly<Record<string, string | number | boolean>>;
}

export interface KernelReadGateway {
  read<TResult = unknown>(request: KernelReadRequest): Promise<KernelOperationResult<TResult>>;
}

export interface KernelComponentPort {
  componentId: string;
  capabilities: readonly string[];
  handle<TResult = unknown>(request: KernelOperationRequest): Promise<TResult>;
}

export interface KernelGateway extends KernelReadGateway {
  register(port: KernelComponentPort): void;
  execute<TPayload = unknown, TResult = unknown>(
    request: KernelOperationRequest<TPayload>
  ): Promise<KernelOperationResult<TResult>>;
}

export interface KernelFoundationContracts {
  gateway: KernelGateway;
  permissions: KernelPermissionEngine;
  audit: KernelAuditWriter;
  events: KernelEventPublisher;
  configuration: KernelConfigurationReader;
}

export function toPermissionRequest(
  request: KernelOperationRequest | KernelReadRequest
): PermissionRequest {
  const reason = readPayloadString(request, 'reason');
  const targetId = readPayloadString(request, 'componentId') ?? readPayloadString(request, 'name');
  return {
    resource: request.target,
    action: request.action,
    targetId,
    attributes: { capability: request.capability, ...(reason ? { reason } : {}) },
  };
}

function readPayloadString(
  request: KernelOperationRequest | KernelReadRequest,
  property: string
): string | undefined {
  if (!('payload' in request) || !request.payload || typeof request.payload !== 'object') {
    return undefined;
  }
  const value = (request.payload as Record<string, unknown>)[property];
  return typeof value === 'string' ? value : undefined;
}
