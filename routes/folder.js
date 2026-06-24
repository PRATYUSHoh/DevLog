const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { requireJWT } = require('../middlewares/auth');
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');

/**
 * @swagger
 * /api/folders:
 *   post:
 *     summary: Create a new folder
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Q2 Architecture Diagrams
 *     responses:
 *       201:
 *         description: Folder created
 *       400:
 *         description: Folder name is required
 */
router.post('/', requireJWT, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Folder name is required' });
        const folder = await prisma.folder.create({
            data: { name, userId: req.user.id }
        });
        res.status(201).json(folder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/folders:
 *   get:
 *     summary: List all folders owned by current user
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of folders with file count
 */
router.get('/', requireJWT, async (req, res) => {
    try {
        const folders = await prisma.folder.findMany({
            where: { userId: req.user.id },
            include: { _count: { select: { files: true } } }
        });
        res.json(folders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/folders/{id}:
 *   put:
 *     summary: Rename a folder (owner only)
 *     tags: [Folders]
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
 *               name:
 *                 type: string
 *                 example: Q3 Architecture Diagrams
 *     responses:
 *       200:
 *         description: Folder renamed
 *       403:
 *         description: Access denied
 *       404:
 *         description: Folder not found
 */
router.put('/:id', requireJWT, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Folder name is required' });
        const folder = await prisma.folder.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!folder || folder.userId !== req.user.id) {
            return res.status(404).json({ error: 'Folder not found or access denied' });
        }
        const updatedFolder = await prisma.folder.update({
            where: { id: parseInt(req.params.id) },
            data: { name }
        });
        res.json(updatedFolder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/folders/{id}:
 *   delete:
 *     summary: Delete a folder and all its files (owner only)
 *     tags: [Folders]
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
 *         description: Folder and files deleted
 *       404:
 *         description: Folder not found or access denied
 */
router.delete('/:id', requireJWT, async (req, res) => {
    try {
        const folder = await prisma.folder.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!folder || folder.userId !== req.user.id) {
            return res.status(404).json({ error: 'Folder not found or access denied' });
        }
        const files = await prisma.file.findMany({ where: { folderId: parseInt(req.params.id) } });
        for (const file of files) {
            await cloudinary.uploader.destroy(file.publicId);
        }
        await prisma.folder.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Folder and its files deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/folders/{id}/share:
 *   post:
 *     summary: Generate a share link for a folder
 *     tags: [Folders]
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
 *             required: [duration]
 *             properties:
 *               duration:
 *                 type: string
 *                 enum: [1d, 7d, 30d]
 *                 example: 7d
 *     responses:
 *       201:
 *         description: Share link token and expiry returned
 *       400:
 *         description: Invalid duration
 *       404:
 *         description: Folder not found or access denied
 */
router.post('/:id/share', requireJWT, async (req, res) => {
    try {
        const { duration } = req.body;
        const validDurations = ['1d', '7d', '30d'];
        if (!validDurations.includes(duration)) {
            return res.status(400).json({ error: 'Invalid duration. Must be one of: 1d, 7d, 30d' });
        }
        const folder = await prisma.folder.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!folder || folder.userId !== req.user.id) {
            return res.status(404).json({ error: 'Folder not found or access denied' });
        }
        const token = crypto.randomUUID();
        const durationMs = { '1d': 1, '7d': 7, '30d': 30 };
        const expiresAt = new Date(Date.now() + durationMs[duration] * 24 * 60 * 60 * 1000);
        const shareLink = await prisma.shareLink.create({
            data: { token, folderId: folder.id, expiresAt }
        });
        res.status(201).json({ token: shareLink.token, expiresAt: shareLink.expiresAt });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;