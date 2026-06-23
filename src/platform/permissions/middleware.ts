import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { KernelRequestContext } from '@/platform/kernel/context';
import type { KernelPermissionEngine, PermissionRequest } from '@/platform/permissions/contracts';

export interface PermissionMiddlewareOptions {
  engine: KernelPermissionEngine;
  permission: (request: Request, response: Response) => PermissionRequest;
}

export function requireKernelPermission(options: PermissionMiddlewareOptions): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    const context = response.locals.kernelContext as KernelRequestContext | undefined;
    if (!context?.actor.authenticated || !context.actor.id) {
      response.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    try {
      const decision = await options.engine.evaluate(
        context,
        options.permission(request, response)
      );
      response.locals.permissionDecision = decision;
      if (decision.effect !== 'allow') {
        response.status(403).json({
          success: false,
          error: 'Permission denied',
          correlationId: context.correlationId,
        });
        return;
      }
      next();
    } catch {
      response.status(403).json({
        success: false,
        error: 'Permission denied',
        correlationId: context.correlationId,
      });
    }
  };
}
