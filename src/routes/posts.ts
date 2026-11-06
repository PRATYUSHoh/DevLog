import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { requireJWT, requireAdmin, optionalJWT } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createPostSchema, updatePostSchema } from '../schemas';

const router = Router();

function parseParamId(param: string | string[] | undefined): number {
  if (Array.isArray(param)) return parseInt(param[0]);
  return parseInt(param || '');
}

router.get('/', optionalJWT, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const isMember = Boolean(req.user?.isMember);
  const isAdmin = Boolean(req.user?.isAdmin);

  const where: any = {};
  if (req.query.status === 'draft') {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required to view drafts' });
    }
    where.isPublished = false;
    if (!isAdmin) {
      where.authorId = req.user.id;
    }
  } else if (req.query.status === 'all') {
    if (!isAdmin) {
      where.isPublished = true;
    }
  } else {
    where.isPublished = true;
  }

  if (req.query.teamId) {
    where.teamId = parseInt(req.query.teamId as string);
  }

  const posts = await prisma.post.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      title: true,
      content: true,
      isPublished: true,
      teamId: true,
      team: { select: { id: true, name: true } },
      createdAt: isMember || isAdmin,
      author: (isMember || isAdmin) ? { select: { username: true } } : false,
    },
  });
  res.json(posts);
});

router.get('/:id', optionalJWT, async (req: Request, res: Response) => {
  const postId = parseParamId(req.params.id);
  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  const isMember = Boolean(req.user?.isMember);
  const isAdmin = Boolean(req.user?.isAdmin);
  const canSeeAttribution = isMember || isAdmin;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      content: true,
      isPublished: true,
      authorId: true,
      teamId: true,
      team: { select: { id: true, name: true } },
      createdAt: canSeeAttribution,
      author: canSeeAttribution ? { select: { username: true } } : false,
    },
  });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  if (!post.isPublished) {
    const isAuthor = Boolean(req.user && req.user.id === post.authorId);
    if (!isAdmin && !isAuthor) {
      return res.status(404).json({ error: 'Post not found or not published' });
    }
  }

  res.json(post);
});

router.post('/', requireJWT, validate(createPostSchema), async (req: Request, res: Response) => {
  const { title, content, teamId } = req.body;
  const post = await prisma.post.create({
    data: {
      title,
      content,
      authorId: req.user!.id,
      teamId: teamId ? Number(teamId) : null,
      isPublished: false
    },
  });
  res.status(201).json(post);
});

router.put('/:id', requireJWT, validate(updatePostSchema), async (req: Request, res: Response) => {
  const postId = parseParamId(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.authorId !== req.user!.id) {
    return res.status(403).json({ error: 'You can only edit your own posts' });
  }

  const updateData: any = {};
  if (req.body.title !== undefined) updateData.title = req.body.title;
  if (req.body.content !== undefined) updateData.content = req.body.content;

  const updated = await prisma.post.update({
    where: { id: postId },
    data: updateData,
  });
  res.json(updated);
});

router.delete('/:id', requireJWT, requireAdmin, async (req: Request, res: Response) => {
  const postId = parseParamId(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  await prisma.post.delete({ where: { id: postId } });
  res.json({ message: 'Post deleted' });
});

router.patch('/:id/publish', requireJWT, requireAdmin, async (req: Request, res: Response) => {
  const postId = parseParamId(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const updated = await prisma.post.update({
    where: { id: postId },
    data: { isPublished: !post.isPublished },
  });
  res.json(updated);
});

export default router;
