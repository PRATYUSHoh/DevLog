const express = require('express');
const router = express.Router({ mergeParams: true });
const prisma = require('../config/prisma');
const { requireJWT, requireAdmin, optionalJWT } = require('../middlewares/auth');

/**
 * @swagger
 * /api/posts/{id}/comments:
 *   post:
 *     summary: Add a comment to a post
 *     tags: [Comments]
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
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 example: Great post!
 *     responses:
 *       201:
 *         description: Comment created
 *       400:
 *         description: Comment text is required
 *       404:
 *         description: Post not found
 */
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

/**
 * @swagger
 * /api/posts/{id}/comments:
 *   get:
 *     summary: Get all comments for a post
 *     tags: [Comments]
 *     security: []
 *     description: Members see author name. Guests see anonymous comments.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: List of comments
 */
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

/**
 * @swagger
 * /api/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment (admin only)
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Comment deleted
 *       403:
 *         description: Admins only
 *       404:
 *         description: Comment not found
 */
router.delete('/:commentId', requireJWT, requireAdmin, async (req, res) => {
  const comment = await prisma.comment.findUnique({ where: { id: parseInt(req.params.commentId) } });
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  await prisma.comment.delete({ where: { id: parseInt(req.params.commentId) } });
  res.json({ message: 'Comment deleted' });
});

module.exports = router;