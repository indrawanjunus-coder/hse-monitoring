import { ZodSchema, ZodError } from "zod";
import { Request, Response, NextFunction } from "express";

// [SECURITY M3] Zod body validation middleware
// Usage: router.post("/", validateBody(MySchema), handler)
// On validation failure returns 400 with flattened field errors.
// On success, req.body is replaced with the parsed (type-safe) value.
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const err = result.error as ZodError;
      res.status(400).json({
        error: "Validasi input gagal",
        details: err.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
