import { OpenAPIRegistry, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extend Zod with .openapi() once, at module load. Any subsequent import of `z`
// from "zod" will have the method attached.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();
