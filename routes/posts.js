const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { requireJWT, requireAdmin, optionalJWT } = require('../middlewares/auth');

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get all published posts
 *     tags: [Posts]
 *     security: []
 *     description: Members see author name and createdAt. Guests see posts only.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 10
 *     responses:
 *       200:
 *         description: List of published posts
 */
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

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get a single post
 *     tags: [Posts]
 *     security: []
 *     description: Members see author name and createdAt. Guests see post only.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Post object
 *       404:
 *         description: Post not found
 */
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

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post (draft)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *                 example: How we handle payment retry logic
 *               content:
 *                 type: string
 *                 example: At Razorpay we use exponential backoff...
 *     responses:
 *       201:
 *         description: Post created as draft
 *       400:
 *         description: title and content are required
 */
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

/**
 * @swagger
 * /api/posts/{id}:
 *   put:
 *     summary: Edit a post (author only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Post updated
 *       403:
 *         description: You can only edit your own posts
 *       404:
 *         description: Post not found
 */
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

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post (admin only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Post deleted
 *       403:
 *         description: Admins only
 *       404:
 *         description: Post not found
 */
router.delete('/:id', requireJWT, requireAdmin, async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  await prisma.post.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ message: 'Post deleted' });
});

/**
 * @swagger
 * /api/posts/{id}/publish:
 *   patch:
 *     summary: Toggle publish/unpublish a post (admin only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: isPublished toggled
 *       403:
 *         description: Admins only
 *       404:
 *         description: Post not found
 */
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