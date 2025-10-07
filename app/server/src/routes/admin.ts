import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma.js';
import { requireAdminPin } from '../auth.js';
import {
  activateRoutineSchema,
  createChildSchema,
  createRoutineSchema,
  createTaskSchema,
  estimateDefaultsSchema,
} from '../util/zodSchemas.js';
import { estimateDurations } from '../services/llmEstimate.js';

function parseDateOrNull(value?: string | null) {
  if (!value) return null;
  return new Date(value);
}

function calculateAgeYears(birthdate: Date | null) {
  if (!birthdate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const monthDiff = now.getMonth() - birthdate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthdate.getDate())) {
    age -= 1;
  }
  return age;
}

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', (request, reply, done) => requireAdminPin(request, reply, done));

  fastify.get('/api/admin/bootstrap', async () => {
    const [children, tasks, routines] = await Promise.all([
      prisma.child.findMany({ orderBy: { name: 'asc' } }),
      prisma.task.findMany({ orderBy: { title: 'asc' } }),
      prisma.routine.findMany({
        include: {
          defaults: { orderBy: { orderIndex: 'asc' } },
          children: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { children, tasks, routines };
  });

  fastify.post('/api/admin/children', async (request, reply) => {
    const body = createChildSchema.parse(request.body);
    const child = await prisma.child.create({
      data: {
        name: body.name,
        birthdate: parseDateOrNull(body.birthdate ?? undefined),
        active: body.active ?? true,
      },
    });
    reply.code(201);
    return child;
  });

  fastify.put('/api/admin/children/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = createChildSchema.partial().parse(request.body);
    const child = await prisma.child.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.birthdate !== undefined ? { birthdate: parseDateOrNull(body.birthdate) } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });
    return child;
  });

  fastify.delete('/api/admin/children/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.child.delete({ where: { id } });
    reply.code(204);
  });

  fastify.post('/api/admin/tasks', async (request, reply) => {
    const body = createTaskSchema.parse(request.body);
    const task = await prisma.task.create({
      data: {
        title: body.title,
        emoji: body.emoji ?? null,
        internalDescription: body.internalDescription ?? null,
      },
    });
    reply.code(201);
    return task;
  });

  fastify.put('/api/admin/tasks/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = createTaskSchema.partial().parse(request.body);
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(body.title ? { title: body.title } : {}),
        ...(body.emoji !== undefined ? { emoji: body.emoji ?? null } : {}),
        ...(body.internalDescription !== undefined ? { internalDescription: body.internalDescription ?? null } : {}),
      },
    });
    return task;
  });

  fastify.delete('/api/admin/tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.task.delete({ where: { id } });
    reply.code(204);
  });

  fastify.post('/api/admin/routines', async (request, reply) => {
    const body = createRoutineSchema.parse(request.body);
    const routine = await prisma.$transaction(async (tx) => {
      const created = await tx.routine.create({
        data: {
          title: body.title,
          startTime: body.startTime,
          endTime: body.endTime,
          active: body.active ?? true,
        },
      });
      await tx.routineChild.createMany({
        data: body.childIds.map((childId) => ({ routineId: created.id, childId })),
      });
      await tx.routineTaskDefault.createMany({
        data: body.taskOrder.map(({ taskId, orderIndex }) => ({
          routineId: created.id,
          taskId,
          orderIndex,
          estSeconds: 60,
        })),
      });
      return created;
    });

    const defaults = await ensureDefaultsWithEstimates(routine.id);
    reply.code(201);
    return { routine, defaults };
  });

  fastify.put('/api/admin/routines/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = createRoutineSchema.partial().parse(request.body);

    const routine = await prisma.$transaction(async (tx) => {
      const updated = await tx.routine.update({
        where: { id },
        data: {
          ...(body.title ? { title: body.title } : {}),
          ...(body.startTime ? { startTime: body.startTime } : {}),
          ...(body.endTime ? { endTime: body.endTime } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
      });

      if (body.childIds) {
        await tx.routineChild.deleteMany({ where: { routineId: id } });
        await tx.routineChild.createMany({ data: body.childIds.map((childId) => ({ routineId: id, childId })) });
      }
      if (body.taskOrder) {
        await tx.routineTaskDefault.deleteMany({ where: { routineId: id } });
        await tx.routineTaskDefault.createMany({
          data: body.taskOrder.map(({ taskId, orderIndex }) => ({
            routineId: id,
            taskId,
            orderIndex,
            estSeconds: 60,
          })),
        });
      }
      return updated;
    });

    const defaults = await ensureDefaultsWithEstimates(id);
    return { routine, defaults };
  });

  fastify.delete('/api/admin/routines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.$transaction(async (tx) => {
      await tx.routineTaskDefault.deleteMany({ where: { routineId: id } });
      await tx.routineChild.deleteMany({ where: { routineId: id } });
      await tx.session.deleteMany({ where: { routineId: id } });
      await tx.routine.delete({ where: { id } });
    });
    reply.code(204);
  });

  fastify.post('/api/admin/routines/:id/estimate-defaults', async (request) => {
    const { id } = request.params as { id: string };
    const body = estimateDefaultsSchema.parse(request.body);
    const defaults = await createEstimates(id, body.startTime, body.endTime, body.childIds, body.taskIds);
    return defaults;
  });

  fastify.post('/api/admin/activate', async (request) => {
    const body = activateRoutineSchema.parse(request.body);
    const routine = await prisma.routine.findUnique({
      where: { id: body.routineId },
      include: { defaults: true },
    });
    if (!routine) {
      throw new Error('Routine not found');
    }

    const tasks = await prisma.task.findMany({ where: { id: { in: body.orderedTaskIds } } });
    const defaultsMap = new Map(routine.defaults.map((d) => [d.taskId, d]));
    const changedWindow = routine.startTime !== body.windowStart || routine.endTime !== body.windowEnd;
    const changedTasks = body.orderedTaskIds.length !== routine.defaults.length ||
      body.orderedTaskIds.some((taskId, index) => {
        const defaultEntry = defaultsMap.get(taskId);
        return !defaultEntry || defaultEntry.orderIndex !== index;
      });

    let estimates: Record<string, number> = {};
    if (changedWindow || changedTasks) {
      const estimateResult = await createEstimates(
        body.routineId,
        body.windowStart,
        body.windowEnd,
        body.childIds,
        body.orderedTaskIds,
      );
      estimates = Object.fromEntries(estimateResult.estimates.map((e) => [e.taskId, e.estSeconds]));
    } else {
      for (const taskId of body.orderedTaskIds) {
        const entry = defaultsMap.get(taskId);
        if (entry) {
          estimates[taskId] = entry.estSeconds;
        }
      }
    }

    const sessions = await prisma.$transaction(async (tx) => {
      const createdSessions = [] as any[];
      for (const childId of body.childIds) {
        const session = await tx.session.create({
          data: {
            routineId: body.routineId,
            childId,
            dateISO: body.dateISO,
            status: 'running',
            windowStart: body.windowStart,
            windowEnd: body.windowEnd,
            startedAt: new Date(),
          },
        });
        let orderIndex = 0;
        for (const taskId of body.orderedTaskIds) {
          await tx.sessionTask.create({
            data: {
              sessionId: session.id,
              taskId,
              orderIndex,
              plannedSecs: estimates[taskId] ?? 60,
              status: 'pending',
            },
          });
          orderIndex += 1;
        }
        createdSessions.push(session);
      }
      return createdSessions;
    });

    return { sessions };
  });
}

async function ensureDefaultsWithEstimates(routineId: string) {
  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    include: {
      defaults: { orderBy: { orderIndex: 'asc' } },
      children: { include: { child: true } },
    },
  });
  if (!routine) {
    throw new Error('Routine not found');
  }
  const tasks = await prisma.task.findMany({
    where: { id: { in: routine.defaults.map((d) => d.taskId) } },
  });
  const payload = buildEstimatePayload(routine, tasks);
  try {
    const result = await estimateDurations(payload);
    await prisma.$transaction(async (tx) => {
      for (const estimate of result.estimates) {
        await tx.routineTaskDefault.update({
          where: { routineId_taskId: { routineId: routine.id, taskId: estimate.taskId } },
          data: { estSeconds: estimate.estimatedSeconds },
        });
      }
    });
  } catch (error) {
    // leave defaults at initial fallback value
    console.warn('Failed to fetch LLM estimate; using default 60s', error);
  }
  return prisma.routineTaskDefault.findMany({
    where: { routineId },
    orderBy: { orderIndex: 'asc' },
  });
}

async function createEstimates(
  routineId: string,
  startTime: string,
  endTime: string,
  childIds: string[],
  taskIds: string[],
) {
  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    include: { children: { include: { child: true } }, defaults: true },
  });
  if (!routine) {
    throw new Error('Routine not found');
  }
  const tasks = await prisma.task.findMany({ where: { id: { in: taskIds } } });
  const payload = buildEstimatePayload(
    { ...routine, startTime, endTime },
    tasks,
    childIds,
    taskIds,
  );
  try {
    const result = await estimateDurations(payload);
    await prisma.$transaction(async (tx) => {
      await tx.routineTaskDefault.deleteMany({ where: { routineId, taskId: { in: taskIds } } });
      let orderIndex = 0;
      for (const taskId of taskIds) {
        const est = result.estimates.find((e) => e.taskId === taskId)?.estimatedSeconds ?? 60;
        await tx.routineTaskDefault.upsert({
          where: { routineId_taskId: { routineId, taskId } },
          update: { orderIndex, estSeconds: est },
          create: { routineId, taskId, orderIndex, estSeconds: est },
        });
        orderIndex += 1;
      }
    });
    return {
      estimates: result.estimates.map((e) => ({ taskId: e.taskId, estSeconds: e.estimatedSeconds })),
      notes: result.notes ?? null,
    };
  } catch (error) {
    console.warn('Failed to fetch activation estimates; using fallback 60s', error);
    await prisma.$transaction(async (tx) => {
      await tx.routineTaskDefault.deleteMany({ where: { routineId, taskId: { in: taskIds } } });
      let orderIndex = 0;
      for (const taskId of taskIds) {
        await tx.routineTaskDefault.upsert({
          where: { routineId_taskId: { routineId, taskId } },
          update: { orderIndex, estSeconds: 60 },
          create: { routineId, taskId, orderIndex, estSeconds: 60 },
        });
        orderIndex += 1;
      }
    });
    return {
      estimates: taskIds.map((taskId) => ({ taskId, estSeconds: 60 })),
      notes: 'Fallbackestimat på 60 sekunder per opgave',
    };
  }
}

function buildEstimatePayload(
  routine: any,
  tasks: { id: string; title: string; internalDescription: string | null }[],
  overrideChildIds?: string[],
  overrideTaskIds?: string[],
) {
  const childRecords = overrideChildIds
    ? routine.children.filter((c: any) => overrideChildIds.includes(c.childId))
    : routine.children;
  const taskIds = overrideTaskIds ?? routine.defaults.map((d: any) => d.taskId);
  const orderedDefaults = routine.defaults?.slice().sort((a: any, b: any) => a.orderIndex - b.orderIndex) ?? [];
  const priorEstimates: Record<string, number> = {};
  for (const d of orderedDefaults) {
    priorEstimates[d.taskId] = d.estSeconds;
  }

  return {
    routineTitle: routine.title,
    window: { from: routine.startTime, to: routine.endTime },
    children: childRecords.map((childRel: any) => ({
      name: childRel.child.name,
      ageYears: calculateAgeYears(childRel.child.birthdate),
    })),
    tasks: taskIds.map((id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) {
        throw new Error(`Task ${id} missing`);
      }
      return {
        id: task.id,
        title: task.title,
        internalDescription: task.internalDescription ?? '',
      };
    }),
    priorEstimatesSeconds: Object.keys(priorEstimates).length ? priorEstimates : null,
    activationOverrides: null,
  };
}
