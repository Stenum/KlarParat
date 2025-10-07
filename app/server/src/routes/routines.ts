import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma.js';

export async function routinesRoutes(fastify: FastifyInstance) {
  fastify.get('/api/routines', async () => {
    const routines = await prisma.routine.findMany({
      where: { active: true },
      include: {
        children: { include: { child: true } },
        defaults: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { title: 'asc' },
    });
    return routines.map((routine) => ({
      id: routine.id,
      title: routine.title,
      startTime: routine.startTime,
      endTime: routine.endTime,
      children: routine.children.map((rc) => ({ id: rc.childId, name: rc.child.name })),
      tasks: routine.defaults.map((d) => ({ taskId: d.taskId, estSeconds: d.estSeconds, orderIndex: d.orderIndex })),
    }));
  });
}
