import { z } from 'zod';
import { generateSlotsSchema, generateSlotsResponseSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  slots: {
    generate: {
      method: 'POST' as const,
      path: '/api/generate-slots' as const,
      input: generateSlotsSchema,
      responses: {
        200: generateSlotsResponseSchema,
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type GenerateSlotsInput = z.infer<typeof api.slots.generate.input>;
export type GenerateSlotsResponse = z.infer<typeof api.slots.generate.responses[200]>;
