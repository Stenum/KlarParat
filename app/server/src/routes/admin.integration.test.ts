import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const databaseName = `test-admin-${process.pid}-${Date.now()}.db`;
const databaseUrl = `file:./${databaseName}`;
const sqlitePath = path.resolve(projectRoot, 'prisma', databaseName);

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = databaseUrl;
process.env.ADMIN_PIN = '1234';
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.OPENAI_TEXT_MODEL = 'gpt-test';
process.env.OPENAI_TTS_MODEL = 'gpt-tts';
process.env.OPENAI_TTS_VOICE = 'test';
process.env.RATE_LIMIT_POINTS = '100';
process.env.RATE_LIMIT_DURATION = '60';

const estimateMock = vi.fn(async ({ tasks }: { tasks: Array<{ id: string }> }) => ({
  estimates: tasks.map((task, index) => ({
    taskId: task.id,
    estimatedSeconds: 90 + index * 15,
  })),
  notes: null,
}));

vi.mock('../services/llmEstimate.js', () => ({
  estimateDurations: estimateMock,
}));

const { prisma } = await import('../prisma.js');
const { createServer } = await import('../app.js');

describe('admin and routines routes with sqlite database', () => {
  const adminHeaders = { 'x-admin-pin': '1234' };
  let server: Awaited<ReturnType<typeof createServer>> | null = null;

  beforeAll(async () => {
    execSync('npx prisma db push --force-reset --skip-generate', {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
    server = await createServer({ logger: false, disableRateLimit: true, disableDocs: true });
    await server.ready();
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.speechLog.deleteMany(),
      prisma.sessionTask.deleteMany(),
      prisma.session.deleteMany(),
      prisma.routineTaskDefault.deleteMany(),
      prisma.routineChild.deleteMany(),
      prisma.routine.deleteMany(),
      prisma.task.deleteMany(),
      prisma.child.deleteMany(),
    ]);
    estimateMock.mockClear();
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
    await prisma.$disconnect();
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      try {
        fs.rmSync(`${sqlitePath}${suffix}`, { force: true });
      } catch {
        // ignore cleanup failures
      }
    }
  });

  it('creates routines with related defaults and children through the admin API', async () => {
    if (!server) {
      throw new Error('Server not initialised');
    }
    const childResponse = await server.inject({
      method: 'POST',
      url: '/api/admin/children',
      headers: adminHeaders,
      payload: { name: 'Alma', active: true },
    });
    expect(childResponse.statusCode).toBe(201);
    const child = childResponse.json();

    const firstTaskResponse = await server.inject({
      method: 'POST',
      url: '/api/admin/tasks',
      headers: adminHeaders,
      payload: { title: 'Brush teeth' },
    });
    const secondTaskResponse = await server.inject({
      method: 'POST',
      url: '/api/admin/tasks',
      headers: adminHeaders,
      payload: { title: 'Eat breakfast' },
    });
    expect(firstTaskResponse.statusCode).toBe(201);
    expect(secondTaskResponse.statusCode).toBe(201);
    const taskA = firstTaskResponse.json();
    const taskB = secondTaskResponse.json();

    const routineResponse = await server.inject({
      method: 'POST',
      url: '/api/admin/routines',
      headers: adminHeaders,
      payload: {
        title: 'Morning',
        startTime: '07:00',
        endTime: '07:30',
        childIds: [child.id],
        taskOrder: [
          { taskId: taskA.id, orderIndex: 0 },
          { taskId: taskB.id, orderIndex: 1 },
        ],
        active: true,
      },
    });

    expect(routineResponse.statusCode).toBe(201);
    expect(estimateMock).toHaveBeenCalledOnce();

    const payload = routineResponse.json();
    expect(payload.defaults).toHaveLength(2);
    expect(payload.defaults[0].estSeconds).toBe(90);
    expect(payload.defaults[1].estSeconds).toBe(105);

    const savedRoutine = await prisma.routine.findUnique({
      where: { id: payload.routine.id },
      include: {
        defaults: { orderBy: { orderIndex: 'asc' } },
        children: true,
      },
    });
    expect(savedRoutine).not.toBeNull();
    expect(savedRoutine?.children).toHaveLength(1);
    expect(savedRoutine?.children[0]?.childId).toBe(child.id);
    expect(savedRoutine?.defaults.map((d) => d.estSeconds)).toEqual([90, 105]);
  });

  it('returns active routines with relational children and tasks', async () => {
    if (!server) {
      throw new Error('Server not initialised');
    }
    const child = await prisma.child.create({ data: { name: 'Otto' } });
    const routine = await prisma.routine.create({
      data: { title: 'Evening', startTime: '19:00', endTime: '19:45', active: true },
    });
    const task = await prisma.task.create({ data: { title: 'Read book' } });
    await prisma.routineChild.create({ data: { routineId: routine.id, childId: child.id } });
    await prisma.routineTaskDefault.create({
      data: {
        routineId: routine.id,
        taskId: task.id,
        orderIndex: 0,
        estSeconds: 180,
      },
    });

    const response = await server.inject({ method: 'GET', url: '/api/routines' });
    expect(response.statusCode).toBe(200);
    const routines = response.json();
    expect(routines).toHaveLength(1);
    expect(routines[0]).toMatchObject({
      title: 'Evening',
      children: [{ id: child.id, name: 'Otto' }],
      tasks: [{ taskId: task.id, estSeconds: 180, orderIndex: 0 }],
    });
  });
});
