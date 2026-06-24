const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { requireJWT } = require('../middlewares/auth');
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');

// POST /api/folders
router.post('/', requireJWT, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        const folder = await prisma.folder.create({
            data: {
                name,
                userId: req.user.id
            }
        });
        res.status(201).json(folder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/folders
router.get('/', requireJWT, async (req, res) => {
    try {
        const folders = await prisma.folder.findMany({
            where: { userId: req.user.id },
            include: {
                _count: {
                    select: { files: true }
                }
            }
        });
        res.json(folders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/folders/:id
router.put('/:id', requireJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        const folder = await prisma.folder.findUnique({
            where: { id: parseInt(id) }
        });

        if (!folder || folder.userId !== req.user.id) {
            return res.status(404).json({ error: 'Folder not found or access denied' });
        }

        const updatedFolder = await prisma.folder.update({
            where: { id: parseInt(id) },
            data: { name }
        });

        res.json(updatedFolder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/folders/:id
router.delete('/:id', requireJWT, async (req, res) => {
    try {
        const { id } = req.params;

        const folder = await prisma.folder.findUnique({
            where: { id: parseInt(id) }
        });

        if (!folder || folder.userId !== req.user.id) {
            return res.status(404).json({ error: 'Folder not found or access denied' });
        }

        const files = await prisma.file.findMany({
            where: { folderId: parseInt(id) }
        });

        for (const file of files) {
            await cloudinary.uploader.destroy(file.publicId);
        }

        await prisma.folder.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Folder and its files deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/folders/:id/share
router.post('/:id/share', requireJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const { duration } = req.body;

        const validDurations = ['1d', '7d', '30d'];
        if (!validDurations.includes(duration)) {
            return res.status(400).json({ error: 'Invalid duration. Must be one of: 1d, 7d, 30d' });
        }

        const folder = await prisma.folder.findUnique({
            where: { id: parseInt(id) }
        });

        if (!folder || folder.userId !== req.user.id) {
            return res.status(404).json({ error: 'Folder not found or access denied' });
        }

        const token = crypto.randomUUID();
        const durationMs = { '1d': 1, '7d': 7, '30d': 30 };
        const expiresAt = new Date(Date.now() + durationMs[duration] * 24 * 60 * 60 * 1000);

        const shareLink = await prisma.shareLink.create({
            data: {
                token,
                folderId: folder.id,
                expiresAt
            }
        });

        res.status(201).json({ token: shareLink.token, expiresAt: shareLink.expiresAt });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;