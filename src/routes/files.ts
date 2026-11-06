import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { requireJWT } from '../middlewares/auth';
import upload from '../config/multer';
import { uploadToCloudinary } from '../services/cloudinary';
import cloudinary from '../config/cloudinary';

const router = Router();

function parseParamId(param: string | string[] | undefined): number {
  if (Array.isArray(param)) return parseInt(param[0]);
  return parseInt(param || '');
}

router.post('/upload', requireJWT, (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) return next(err);
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    const postId = req.query.postId ? parseInt(req.query.postId as string) : (req.body?.postId ? parseInt(req.body.postId) : null);
    const folderId = req.body?.folderId ? parseInt(req.body.folderId) : (req.query?.folderId ? parseInt(req.query.folderId as string) : null);

    const fileRecord = await prisma.file.create({
      data: {
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: result.secure_url,
        publicId: result.public_id,
        uploadedBy: req.user!.id,
        postId: postId ? postId : null,
        folderId: folderId ? folderId : null,
      },
    });
    res.status(201).json({ message: 'File uploaded successfully', file: fileRecord });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', requireJWT, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const files = await prisma.file.findMany({
      where: { uploadedBy: req.user!.id },
      skip: (page - 1) * limit,
      take: limit,
    });
    res.status(200).json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', requireJWT, async (req: Request, res: Response) => {
  try {
    const fileId = parseParamId(req.params.id);
    if (isNaN(fileId)) return res.status(400).json({ error: 'Invalid file ID' });

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.uploadedBy !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    res.status(200).json(file);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireJWT, async (req: Request, res: Response) => {
  try {
    const fileId = parseParamId(req.params.id);
    if (isNaN(fileId)) return res.status(400).json({ error: 'Invalid file ID' });

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.uploadedBy !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    if (process.env.CLOUDINARY_CLOUD_NAME && !file.publicId.startsWith('mock_')) {
      try {
        await cloudinary.uploader.destroy(file.publicId);
      } catch (err: any) {
        console.warn('[AI Studio] Cloudinary destroy error:', err.message);
      }
    }
    await prisma.file.delete({
      where: { id: fileId },
    });
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
