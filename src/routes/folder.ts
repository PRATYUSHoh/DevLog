import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';
import cloudinary from '../config/cloudinary';
import { requireJWT } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createFolderSchema, renameFolderSchema, shareFolderSchema } from '../schemas';

const router = Router();

function parseParamId(param: string | string[] | undefined): number {
  if (Array.isArray(param)) return parseInt(param[0]);
  return parseInt(param || '');
}

router.post('/', requireJWT, validate(createFolderSchema), async (req: Request, res: Response) => {
  try {
    const { name, teamId } = req.body;
    const folder = await prisma.folder.create({
      data: {
        name,
        userId: req.user!.id,
        teamId: teamId ? Number(teamId) : null
      }
    });
    res.status(201).json(folder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', requireJWT, async (req: Request, res: Response) => {
  try {
    const where: any = req.user!.teamId
      ? { OR: [{ userId: req.user!.id }, { teamId: req.user!.teamId }] }
      : { userId: req.user!.id };

    const folders = await prisma.folder.findMany({
      where,
      include: {
        _count: { select: { files: true } },
        team: { select: { id: true, name: true } }
      }
    });
    res.json(folders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireJWT, validate(renameFolderSchema), async (req: Request, res: Response) => {
  try {
    const folderId = parseParamId(req.params.id);
    if (isNaN(folderId)) return res.status(400).json({ error: 'Invalid folder ID' });

    const { name } = req.body;
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Folder not found or access denied' });
    }
    const updatedFolder = await prisma.folder.update({
      where: { id: folderId },
      data: { name }
    });
    res.json(updatedFolder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireJWT, async (req: Request, res: Response) => {
  try {
    const folderId = parseParamId(req.params.id);
    if (isNaN(folderId)) return res.status(400).json({ error: 'Invalid folder ID' });

    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Folder not found or access denied' });
    }
    const files = await prisma.file.findMany({ where: { folderId } });
    for (const file of files) {
      if (process.env.CLOUDINARY_CLOUD_NAME && !file.publicId.startsWith('mock_')) {
        try {
          await cloudinary.uploader.destroy(file.publicId);
        } catch (err: any) {
          console.warn('[DevLog] Cloudinary destroy error:', err.message);
        }
      }
    }
    await prisma.folder.delete({ where: { id: folderId } });
    res.json({ message: 'Folder and its files deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/share', requireJWT, validate(shareFolderSchema), async (req: Request, res: Response) => {
  try {
    const folderId = parseParamId(req.params.id);
    if (isNaN(folderId)) return res.status(400).json({ error: 'Invalid folder ID' });

    const { duration } = req.body;
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Folder not found or access denied' });
    }
    const token = crypto.randomUUID();
    const durationDays: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30 };
    const expiresAt = new Date(Date.now() + (durationDays[duration] || 7) * 24 * 60 * 60 * 1000);
    const shareLink = await prisma.shareLink.create({
      data: { token, folderId: folder.id, expiresAt }
    });
    res.status(201).json({ token: shareLink.token, expiresAt: shareLink.expiresAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
