import { z } from 'zod';

export const createChildSchema = z.object({
  name: z.string().min(1),
  birthdate: z.string().datetime().optional().nullable(),
  active: z.boolean().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1),
  emoji: z
    .string()
    .trim()
    .max(4, 'Emoji må højst være fire tegn')
    .optional()
    .nullable(),
  internalDescription: z.string().max(280).optional().nullable(),
});

export const createRoutineSchema = z.object({
  title: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  childIds: z.array(z.string().min(1)),
  taskOrder: z.array(z.object({ taskId: z.string().min(1), orderIndex: z.number().int().nonnegative() })),
  active: z.boolean().optional(),
});

export const estimateDefaultsSchema = z.object({
  taskIds: z.array(z.string().min(1)),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  childIds: z.array(z.string().min(1)),
});

export const activateRoutineSchema = z.object({
  routineId: z.string().min(1),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowStart: z.string().regex(/^\d{2}:\d{2}$/),
  windowEnd: z.string().regex(/^\d{2}:\d{2}$/),
  childIds: z.array(z.string().min(1)),
  orderedTaskIds: z.array(z.string().min(1)),
});

export type CreateChildInput = z.infer<typeof createChildSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
export type EstimateDefaultsInput = z.infer<typeof estimateDefaultsSchema>;
export type ActivateRoutineInput = z.infer<typeof activateRoutineSchema>;
