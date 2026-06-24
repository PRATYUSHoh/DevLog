const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { requireJWT, requireAdmin } = require('../middlewares/auth');
const upload = require('../config/multer');
const { uploadToCloudinary } = require('../services/cloudinary');
const cloudinary = require('../config/cloudinary');

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Upload a file to Cloudinary
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: postId
 *         schema:
 *           type: integer
 *         description: Optional post to attach file to
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *       400:
 *         description: No file or invalid file type or file too large
 */
router.post('/upload', requireJWT, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) return next(err);
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
        const fileRecord = await prisma.file.create({
            data: {
                name: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
                url: result.secure_url,
                publicId: result.public_id,
                uploadedBy: req.user.id,
                postId: req.query.postId ? parseInt(req.query.postId) : null,
            },
        });
        res.status(201).json({ message: 'File uploaded successfully', file: fileRecord });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: List all files uploaded by current user
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
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
 *         description: List of files
 */
router.get('/', requireJWT, async (req, res) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 10;
        const files = await prisma.file.findMany({
            where: { uploadedBy: req.user.id },
            skip: (page - 1) * limit,
            take: limit,
        });
        res.status(200).json(files);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/files/{id}:
 *   get:
 *     summary: Get a single file metadata
 *     tags: [Files]
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
 *         description: File metadata
 *       403:
 *         description: Not allowed
 *       404:
 *         description: File not found
 */
router.get('/:id', requireJWT, async (req, res) => {
    try {
        const file = await prisma.file.findUnique({
            where: { id: parseInt(req.params.id) },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.uploadedBy !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Not allowed' });
        }
        res.status(200).json(file);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Delete a file (uploader or admin only)
 *     tags: [Files]
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
 *         description: File deleted from Cloudinary and DB
 *       403:
 *         description: Not allowed
 *       404:
 *         description: File not found
 */
router.delete('/:id', requireJWT, async (req, res) => {
    try {
        const file = await prisma.file.findUnique({
            where: { id: parseInt(req.params.id) },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.uploadedBy !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Not allowed' });
        }
        await cloudinary.uploader.destroy(file.publicId);
        await prisma.file.delete({
            where: { id: parseInt(req.params.id) },
        });
        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;