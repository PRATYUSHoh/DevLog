import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { requireJWT, optionalJWT } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createTeamSchema, joinTeamSchema, updateTeamPasswordSchema } from '../schemas';

const router = Router();

function parseParamId(param: string | string[] | undefined): number {
  if (Array.isArray(param)) return parseInt(param[0]);
  return parseInt(param || '');
}

router.get('/', optionalJWT, async (req: Request, res: Response) => {
  try {
    const teams = await prisma.team.findMany();
    const currentUserId = req.user?.id;

    const sanitized = teams.map((t: any) => {
      const isUserMember = currentUserId && t.members ? t.members.includes(currentUserId) : false;
      const isUserOwner = currentUserId && t.ownerId === currentUserId;
      return {
        id: t.id,
        name: t.name,
        description: t.description || '',
        ownerId: t.ownerId,
        ownerUsername: t.ownerUsername || 'admin',
        memberCount: t.memberCount || (t.members ? t.members.length : 1),
        isUserMember,
        isUserOwner,
        createdAt: t.createdAt
      };
    });

    res.json(sanitized);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', optionalJWT, async (req: Request, res: Response) => {
  try {
    const teamId = parseParamId(req.params.id);
    if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const isOwnerOrAdmin = Boolean(req.user && (req.user.id === team.ownerId || req.user.isAdmin));
    const isMember = Boolean(req.user && team.members ? team.members.includes(req.user.id) : false);

    const payload: any = {
      id: team.id,
      name: team.name,
      description: team.description || '',
      ownerId: team.ownerId,
      memberCount: team.members ? team.members.length : 1,
      isUserMember: isMember,
      isUserOwner: Boolean(req.user ? req.user.id === team.ownerId : false),
      createdAt: team.createdAt
    };

    if (isOwnerOrAdmin) {
      payload.password = team.password;
    }

    res.json(payload);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireJWT, validate(createTeamSchema), async (req: Request, res: Response) => {
  const { name, description, password } = req.body;
  try {
    const existing = await prisma.team.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({ error: 'A team with this name already exists.' });
    }

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description: description?.trim() || '',
        password: password.trim(),
        ownerId: req.user!.id
      }
    });

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        isMember: true,
        teamId: team.id
      }
    });

    res.status(201).json({
      message: `Team "${team.name}" created successfully!`,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        ownerId: team.ownerId,
        password: team.password
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/join', requireJWT, validate(joinTeamSchema), async (req: Request, res: Response) => {
  const teamId = parseParamId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

  const { password } = req.body;
  try {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.password !== password.trim()) {
      return res.status(403).json({ error: 'Incorrect team password.' });
    }

    const currentMembers: number[] = team.members || [];
    if (!currentMembers.includes(req.user!.id)) {
      currentMembers.push(req.user!.id);
      await prisma.team.update({
        where: { id: teamId },
        data: { members: currentMembers }
      });
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        isMember: true,
        teamId: team.id
      }
    });

    res.json({
      message: `You have joined "${team.name}"! You now have full internal attribution privileges.`,
      team: { id: team.id, name: team.name }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/leave', requireJWT, async (req: Request, res: Response) => {
  const teamId = parseParamId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

  try {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (team && team.members) {
      const updatedMembers = team.members.filter((uid: number) => uid !== req.user!.id);
      await prisma.team.update({
        where: { id: teamId },
        data: { members: updatedMembers }
      });
    }

    const updateData: any = { teamId: null };
    if (!req.user!.isAdmin) {
      updateData.isMember = false;
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData
    });

    res.json({ message: 'You have left the team. You are now in Guest mode.' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/password', requireJWT, validate(updateTeamPasswordSchema), async (req: Request, res: Response) => {
  const teamId = parseParamId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

  const { password } = req.body;
  try {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Only the team creator or an administrator can change the password.' });
    }

    await prisma.team.update({
      where: { id: teamId },
      data: { password: password.trim() }
    });

    res.json({ message: 'Team password updated successfully!' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
