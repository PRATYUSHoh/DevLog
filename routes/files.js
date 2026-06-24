const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { requireJWT, requireAdmin } = require('../middlewares/auth');
const upload = require('../config/multer');
const { uploadToCloudinary } = require('../services/cloudinary');
const cloudinary = require('../config/cloudinary');

// POST /api/files/upload
// POST /api/files/upload
router.post('/upload', requireJWT, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) return next(err); // passes Multer errors to global handler
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

// GET /api/files — list all files by current user
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

// GET /api/files/:id — single file metadata
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

// DELETE /api/files/:id — uploader or admin only
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