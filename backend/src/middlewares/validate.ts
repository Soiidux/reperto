import { Request, Response, NextFunction } from "express";
import { ZodTypeAny } from "zod";

/**
 * Which part of the request a schema describes.
 *
 * Historically this middleware only ever checked `req.body`, which meant the
 * generated OpenAPI document would have described request bodies while
 * silently omitting every query and path parameter — a spec that looks
 * complete but lies about the parts it never validated.
 *
 * `body` is the default so every existing call site keeps its exact behaviour.
 * `query` and `params` are supported for endpoints that opt in; the generated
 * spec records which source each schema covers, so documentation never implies
 * validation that does not happen.
 */
export type ValidateSource = "body" | "query" | "params";

export type ValidateOptions = {
  source?: ValidateSource;
  /** Strip unknown keys from the parsed body (the default). Ignored otherwise. */
  stripBody?: boolean;
};

export type ValidateMiddleware = ((
  req: Request,
  res: Response,
  next: NextFunction,
) => void) & {
  /** Attached so the OpenAPI generator can read the real schema off the stack. */
  zodSchema: ZodTypeAny;
  validateSource: ValidateSource;
};

export const validate = (
  schema: ZodTypeAny,
  options: ValidateOptions = {},
): ValidateMiddleware => {
  const source = options.source ?? "body";
  const stripBody = options.stripBody ?? true;

  const middleware = ((req: Request, res: Response, next: NextFunction) => {
    const input =
      source === "query" ? req.query : source === "params" ? req.params : req.body;

    const result = schema.safeParse(input);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        data: null,
        // Naming the source makes the error actionable: a client that sent a
        // valid body but a bad ?page= now knows which one was rejected.
        source,
        errors: result.error.flatten().fieldErrors,
      });
    }

    if (source === "body") {
      // Coerce and strip: controllers read the parsed, cleaned values.
      req.body = stripBody ? result.data : result.data;
      next();
      return;
    }

    // Express 5 exposes req.query as a getter-only property, so the parsed
    // value cannot be written back. Query and path values therefore stay as
    // the client sent them and are validated for rejection only. Controllers
    // that need a number must coerce it themselves, which is what they already
    // do. The validated copy is available to handlers on req.validated.
    (req as Request & { validated?: Record<string, unknown> }).validated = {
      ...((req as Request & { validated?: Record<string, unknown> }).validated ??
        {}),
      [source]: result.data,
    };
    next();
  }) as unknown as ValidateMiddleware;

  middleware.zodSchema = schema;
  middleware.validateSource = source;
  return middleware;
};