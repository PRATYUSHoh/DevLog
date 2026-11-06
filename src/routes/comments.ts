import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { requireJWT, requireAdmin, optionalJWT } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createCommentSchema } from '../schemas';

const router = Router({ mergeParams: true });

function parseParamId(param: string | string[] | undefined): number {
  if (Array.isArray(param)) return parseInt(param[0]);
  return parseInt(param || '');
}

router.post('/', requireJWT, validate(createCommentSchema), async (req: Request, res: Response) => {
  const { text } = req.body;
  const postId = parseParamId(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const comment = await prisma.comment.create({
    data: { text, postId, authorId: req.user!.id },
  });
  res.status(201).json(comment);
});

router.get('/', optionalJWT, async (req: Request, res: Response) => {
  const postId = parseParamId(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

  const isMember = Boolean(req.user?.isMember);
  const isAdmin = Boolean(req.user?.isAdmin);
  const canSeeAttribution = isMember || isAdmin;

  const comments = await prisma.comment.findMany({
    where: { postId },
    select: {
      id: true,
      text: true,
      createdAt: true,
      author: canSeeAttribution ? { select: { username: true } } : false,
    },
  });
  res.json(comments);
});

router.delete('/:commentId', requireJWT, requireAdmin, async (req: Request, res: Response) => {
  const commentId = parseParamId(req.params.commentId);
  if (isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  await prisma.comment.delete({ where: { id: commentId } });
  res.json({ message: 'Comment deleted' });
});

export default router;
