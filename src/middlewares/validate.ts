import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body', options?: { asText?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const err = result.error as ZodError;
      const firstMessage = err.issues[0]?.message || 'Validation error';

      if (options?.asText || (!req.is('application/json') && req.headers['content-type']?.includes('application/x-www-form-urlencoded'))) {
        return res.status(400).send(firstMessage);
      }

      return res.status(400).json({
        error: firstMessage,
        errors: err.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
      });
    }

    (req as any)[source] = result.data;
    next();
  };
}
