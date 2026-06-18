const express = require('express');
const router = express.Router({ mergeParams: true });
const prisma = require('../config/prisma');
const { requireJWT, requireAdmin, optionalJWT } = require('../middlewares/auth');

// POST /api/posts/:id/comments
router.post('/', requireJWT, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) {
    return res.status(400).json({ error: 'Comment text is required' });
  }
  const post = await prisma.post.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comment = await prisma.comment.create({
    data: { text, postId: parseInt(req.params.id), authorId: req.user.id },
  });
  res.status(201).json(comment);
});

// GET /api/posts/:id/comments — public, member sees author name
router.get('/', optionalJWT, async (req, res) => {
  const isMember = req.user?.isMember;
  const comments = await prisma.comment.findMany({
    where: { postId: parseInt(req.params.id) },
    select: {
      id: true,
      text: true,
      createdAt: true,
      author: isMember ? { select: { username: true } } : false,
    },
  });
  res.json(comments);
});

// DELETE /api/comments/:commentId — admin only
router.delete('/:commentId', requireJWT, requireAdmin, async (req, res) => {
  const comment = await prisma.comment.findUnique({ where: { id: parseInt(req.params.commentId) } });
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  await prisma.comment.delete({ where: { id: parseInt(req.params.commentId) } });
  res.json({ message: 'Comment deleted' });
});

module.exports = router;