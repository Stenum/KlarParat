import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma.js';
import { generateSpeech, SpeechContext, SpeechKind } from '../services/llmSpeech.js';
import { synthesizeSpeech } from '../services/tts.js';
import { calculateReward } from '../services/reward.js';
import { shouldNudge } from '../services/nudge.js';
import { ENV } from '../env.js';

const FALLBACK_LINES: Record<SpeechKind, string[]> = {
  taskComplete: ['Fint klaret, {name}. Klar til næste ting?'],
  nudge: ['Vil du prøve at komme videre, {name}?'],
  allDone: ['Godt gået i morges, {name}.'],
};

function timeStringToSeconds(value: string) {
  const [h, m] = value.split(':').map(Number);
  return h * 3600 + m * 60;
}

function safeAgeYears(birthdate: Date | null) {
  if (!birthdate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const monthDiff = now.getMonth() - birthdate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthdate.getDate())) {
    age -= 1;
  }
  return age;
}

export async function sessionsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/session/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        child: true,
        routine: true,
        tasks: { include: { task: true }, orderBy: { orderIndex: 'asc' } },
      },
    });
    if (!session) {
      reply.code(404).send({ error: 'Session not found' });
      return;
    }
    return session;
  });

  fastify.post('/api/session/:id/startTask', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { taskId } = request.body as { taskId: string };
    await prisma.sessionTask.updateMany({
      where: { sessionId: id, taskId, startedAt: null },
      data: { startedAt: new Date() },
    });
    reply.code(204);
  });

  fastify.post('/api/session/:id/completeTask', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { taskId } = request.body as { taskId: string };
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        child: true,
        routine: true,
        tasks: { include: { task: true }, orderBy: { orderIndex: 'asc' } },
      },
    });
    if (!session) {
      reply.code(404).send({ error: 'Session not found' });
      return;
    }
    const sessionTask = session.tasks.find((t) => t.taskId === taskId);
    if (!sessionTask) {
      reply.code(404).send({ error: 'Task not part of session' });
      return;
    }
    const now = new Date();
    const startedAt = sessionTask.startedAt ?? now;
    const actualSecs = Math.max(5, Math.round((now.getTime() - startedAt.getTime()) / 1000));
    await prisma.sessionTask.update({
      where: { id: sessionTask.id },
      data: {
        status: 'done',
        startedAt,
        finishedAt: now,
        actualSecs,
      },
    });

    const updatedTasks = session.tasks.map((task) =>
      task.id === sessionTask.id
        ? { ...task, status: 'done', startedAt, finishedAt: now, actualSecs }
        : task,
    );
    const updatedSession = { ...session, tasks: updatedTasks };
    const nextTask = updatedTasks.find((t) => t.orderIndex === sessionTask.orderIndex + 1) ?? null;
    const context = buildSpeechContext('taskComplete', updatedSession, { ...sessionTask, startedAt, finishedAt: now, actualSecs }, nextTask, now);
    const { text, clip } = await speakWithFallback(context);
    await prisma.speechLog.create({
      data: {
        sessionId: session.id,
        kind: 'taskComplete',
        childName: session.child.name,
        text,
        voice: clip ? ENV.OPENAI_TTS_VOICE : 'fallback',
        metaJson: JSON.stringify(context),
      },
    });

    reply.send({
      nextTaskId: nextTask?.taskId ?? null,
      speechText: text,
      ttsUrl: clip?.urlPath ?? null,
      clipId: clip?.clipId ?? null,
    });
  });

  fastify.post('/api/session/:id/nudge', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        child: true,
        routine: true,
        tasks: { include: { task: true }, orderBy: { orderIndex: 'asc' } },
        speechLogs: { where: { kind: 'nudge' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!session) {
      reply.code(404).send({ error: 'Session not found' });
      return;
    }
    const currentTask = session.tasks.find((t) => t.status !== 'done');
    if (!currentTask) {
      reply.code(400).send({ error: 'No pending task' });
      return;
    }
    const lastNudge = session.speechLogs?.[0];
    const now = new Date();
    const canNudge = shouldNudge(
      currentTask.finishedAt,
      currentTask.startedAt,
      currentTask.plannedSecs,
      now,
      lastNudge ? lastNudge.createdAt : null,
    );
    if (!canNudge) {
      reply.code(429).send({ error: 'Nudge throttled' });
      return;
    }

    const context = buildSpeechContext('nudge', session, currentTask, null, now);
    const { text, clip } = await speakWithFallback(context);
    await prisma.speechLog.create({
      data: {
        sessionId: session.id,
        kind: 'nudge',
        childName: session.child.name,
        text,
        voice: clip ? ENV.OPENAI_TTS_VOICE : 'fallback',
        metaJson: JSON.stringify(context),
      },
    });
    reply.send({ speechText: text, ttsUrl: clip?.urlPath ?? null, clipId: clip?.clipId ?? null });
  });

  fastify.post('/api/session/:id/finish', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        child: true,
        routine: true,
        tasks: { orderBy: { orderIndex: 'asc' } },
      },
    });
    if (!session) {
      reply.code(404).send({ error: 'Session not found' });
      return;
    }
    const windowSeconds = timeStringToSeconds(session.windowEnd) - timeStringToSeconds(session.windowStart);
    const plannedTotal = session.tasks.reduce((acc, task) => acc + task.plannedSecs, 0);
    const actualTotal = session.tasks.reduce((acc, task) => acc + (task.actualSecs ?? task.plannedSecs), 0);
    const reward = calculateReward(windowSeconds, plannedTotal, actualTotal);
    const now = new Date();
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'done', finishedAt: now, reward },
    });
    const context = buildSpeechContext('allDone', session, null, null, now, reward);
    const { text, clip } = await speakWithFallback(context);
    await prisma.speechLog.create({
      data: {
        sessionId: session.id,
        kind: 'allDone',
        childName: session.child.name,
        text,
        voice: clip ? ENV.OPENAI_TTS_VOICE : 'fallback',
        metaJson: JSON.stringify(context),
      },
    });
    reply.send({ reward, speechText: text, ttsUrl: clip?.urlPath ?? null, clipId: clip?.clipId ?? null });
  });
}

function buildSpeechContext(
  kind: SpeechKind,
  session: any,
  currentTask: any,
  nextTask: any,
  now: Date,
  reward: string | null = null,
): SpeechContext {
  const startedAt = session.startedAt ? new Date(session.startedAt) : now;
  const elapsedSeconds = Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000));
  const windowSeconds = timeStringToSeconds(session.windowEnd) - timeStringToSeconds(session.windowStart);
  const remainingSeconds = Math.max(0, windowSeconds - elapsedSeconds);
  const tasksDone = session.tasks.filter((t: any) => t.status === 'done').length;
  const plannedCompleted = session.tasks
    .filter((t: any) => t.status === 'done')
    .reduce((acc: number, task: any) => acc + task.plannedSecs, 0);
  const actualCompleted = session.tasks
    .filter((t: any) => t.status === 'done')
    .reduce((acc: number, task: any) => acc + (task.actualSecs ?? task.plannedSecs), 0);
  const paceOnTrack = actualCompleted <= plannedCompleted + 30; // allow small slack

  return {
    kind,
    child: {
      name: session.child.name,
      ageYears: safeAgeYears(session.child.birthdate),
    },
    routine: {
      title: session.routine.title,
      window: { from: session.windowStart, to: session.windowEnd },
      elapsedSeconds,
      remainingSeconds,
    },
    taskContext: {
      current: currentTask
        ? {
            id: currentTask.taskId,
            title: currentTask.task?.title ?? '',
            internalDescription: currentTask.task?.internalDescription ?? '',
          }
        : null,
      next: nextTask
        ? {
            id: nextTask.taskId,
            title: nextTask.task?.title ?? '',
          }
        : null,
    },
    pace: {
      plannedForCurrent: currentTask?.plannedSecs ?? null,
      actualForCurrent: currentTask?.actualSecs ?? null,
      onTrack: paceOnTrack,
    },
    session: {
      tasksDone,
      tasksTotal: session.tasks.length,
      userEditedAtActivation: false,
    },
    reward,
  };
}

async function speakWithFallback(context: SpeechContext) {
  const key = context.kind;
  try {
    const text = await generateSpeech(context);
    const clip = await synthesizeSpeech(text);
    return { text, clip };
  } catch (error) {
    const options = FALLBACK_LINES[key] ?? ['Godt gået, {name}.'];
    const text = options[Math.floor(Math.random() * options.length)].replace('{name}', context.child.name);
    return { text, clip: null };
  }
}
