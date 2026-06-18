const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { requireJWT, requireAdmin, optionalJWT } = require('../middlewares/auth');

// GET /api/posts — public, paginated, role-aware fields
router.get('/', optionalJWT, async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 10;
  const isMember = req.user?.isMember;
  const posts = await prisma.post.findMany({
    where: { isPublished: true },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: isMember,
      author: isMember ? { select: { username: true } } : false,
    },
  });
  res.json(posts);
});

// GET /api/posts/:id — single post
router.get('/:id', optionalJWT, async (req, res) => {
  const isMember = req.user?.isMember;
  const post = await prisma.post.findUnique({
    where: { id: parseInt(req.params.id) },
    select: {
      id: true,
      title: true,
      content: true,
      isPublished: true,
      createdAt: isMember,
      author: isMember ? { select: { username: true } } : false,
    },
  });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// POST /api/posts — JWT required, draft by default
router.post('/', requireJWT, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }
  const post = await prisma.post.create({
    data: { title, content, authorId: req.user.id, isPublished: false },
  });
  res.status(201).json(post);
});

// PUT /api/posts/:id — JWT required, author only
router.put('/:id', requireJWT, async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.authorId !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own posts' });
  }
  const updated = await prisma.post.update({
    where: { id: parseInt(req.params.id) },
    data: { title: req.body.title, content: req.body.content },
  });
  res.json(updated);
});

// DELETE /api/posts/:id — admin only
router.delete('/:id', requireJWT, requireAdmin, async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  await prisma.post.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ message: 'Post deleted' });
});

// PATCH /api/posts/:id/publish — admin only, toggles isPublished
router.patch('/:id/publish', requireJWT, requireAdmin, async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const updated = await prisma.post.update({
    where: { id: parseInt(req.params.id) },
    data: { isPublished: !post.isPublished },
  });
  res.json(updated);
});

module.exports = router;