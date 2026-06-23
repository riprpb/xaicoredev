import type { Express, NextFunction, Request, Response } from 'express';
import type { OwnerOperationsService } from '@/owner-operations/service';
import type { KernelRequestContext } from '@/platform/kernel/context';

export interface AuthenticatedOwnerRequest {
  context: KernelRequestContext;
  csrfToken: string;
}

export interface OwnerRequestAuthenticator {
  authenticate(request: Request): Promise<AuthenticatedOwnerRequest | undefined>;
}

export interface OwnerOperationsRoutes {
  operations: OwnerOperationsService;
  authenticator: OwnerRequestAuthenticator;
}

export function registerOwnerOperationsRoutes(app: Express, options: OwnerOperationsRoutes): void {
  app.get('/api/owner/status', async (request, response, next) => {
    const owner = await authenticate(options, request, response, next);
    if (!owner) return;
    try {
      response.json({ success: true, data: await options.operations.getStatus(owner.context) });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/owner/feature-flags/:name', async (request, response, next) => {
    const owner = await authenticate(options, request, response, next);
    if (!owner) return;
    if (!safeTokenEqual(request.header('x-csrf-token'), owner.csrfToken)) {
      response.status(403).json({ success: false, error: 'Request verification failed' });
      return;
    }
    const { enabled, reason } = request.body as { enabled?: unknown; reason?: unknown };
    if (typeof enabled !== 'boolean' || typeof reason !== 'string' || !reason.trim()) {
      response.status(400).json({ success: false, error: 'Valid value and reason are required' });
      return;
    }
    try {
      const result = await options.operations.updateFeatureFlag(
        owner.context,
        request.params.name,
        enabled,
        reason
      );
      response.status(result.operation.accepted ? 200 : 403).json({
        success: result.operation.accepted,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });
}

async function authenticate(
  options: OwnerOperationsRoutes,
  request: Request,
  response: Response,
  next: NextFunction
): Promise<AuthenticatedOwnerRequest | undefined> {
  try {
    const owner = await options.authenticator.authenticate(request);
    if (!owner || owner.context.actor.kind !== 'owner' || !owner.context.actor.authenticated) {
      response.status(401).json({ success: false, error: 'Authentication required' });
      return undefined;
    }
    return owner;
  } catch (error) {
    next(error);
    return undefined;
  }
}

function safeTokenEqual(actual: string | undefined, expected: string): boolean {
  if (!actual || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}
