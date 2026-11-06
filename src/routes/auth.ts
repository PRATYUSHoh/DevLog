import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { genPassword } from '../lib/passwordUtils';
import { requireJWT } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { registerSchema, loginTokenSchema, passcodeSchema } from '../schemas';

const router = Router();

router.post('/register', validate(registerSchema, 'body', { asText: true }), async (req: Request, res: Response, next: NextFunction) => {
  const { username, email, password } = req.body;
  try {
    const { hash } = await genPassword(password);
    await prisma.user.create({
      data: { username, email, hash, isMember: false, isAdmin: false }
    });
    res.redirect('/login');
  } catch (err) {
    next(err);
  }
});

router.post('/login', passport.authenticate('local', {
  failureRedirect: '/login-failure',
  successRedirect: '/login-success'
}));

router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    if (req.session) {
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie('connect.sid');
        res.redirect('/login');
      });
    } else {
      res.redirect('/login');
    }
  });
});

router.post('/auth/token', validate(loginTokenSchema), passport.authenticate('local', { session: false }), (req: Request, res: Response) => {
  const user = req.user!;
  const payload = {
    id: user.id,
    email: user.email,
    isMember: user.isMember,
    isAdmin: user.isAdmin
  };
  const jwtSecret = process.env.JWT_SECRET || 'devlog-jwt-secret-key-12345';
  const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' });
  res.json({ token });
});

router.post('/auth/refresh', requireJWT, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const payload = {
    id: user.id,
    email: user.email,
    isMember: user.isMember,
    isAdmin: user.isAdmin
  };
  const jwtSecret = process.env.JWT_SECRET || 'devlog-jwt-secret-key-12345';
  const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' });
  res.json({ token });
});

router.post('/auth/join', requireJWT, validate(passcodeSchema), async (req: Request, res: Response, next: NextFunction) => {
  const { passcode } = req.body;
  const expectedPasscode = process.env.MEMBER_PASSCODE || 'devteam123';
  if (passcode !== expectedPasscode) {
    return res.status(403).json({ message: 'Wrong passcode.' });
  }
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { isMember: true }
    });
    res.json({ message: 'You are now a member!' });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/admin', requireJWT, validate(passcodeSchema), async (req: Request, res: Response, next: NextFunction) => {
  const { passcode } = req.body;
  const expectedPasscode = process.env.ADMIN_PASSCODE || 'devadmin123';
  if (passcode !== expectedPasscode) {
    return res.status(403).json({ message: 'Wrong passcode.' });
  }
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { isAdmin: true }
    });
    res.json({ message: 'You are now an admin!' });
  } catch (err) {
    next(err);
  }
});

router.get('/api/me', requireJWT, async (req: Request, res: Response) => {
  let teamName: string | null = null;
  try {
    if (req.user!.teamId && prisma.team) {
      const team = await prisma.team.findUnique({ where: { id: req.user!.teamId } });
      if (team) teamName = team.name;
    }
  } catch (e) {
    // ignore
  }
  res.json({
    id: req.user!.id,
    username: req.user!.username,
    email: req.user!.email,
    isMember: Boolean(req.user!.isMember),
    isAdmin: Boolean(req.user!.isAdmin),
    teamId: req.user!.teamId || null,
    teamName
  });
});

router.get('/public/share/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const shareLink = await prisma.shareLink.findUnique({ where: { token } });
    if (!shareLink) return res.status(404).json({ error: 'Share link not found' });
    if (new Date(shareLink.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }
    const folder = await prisma.folder.findUnique({
      where: { id: shareLink.folderId },
      include: { files: true }
    });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    res.json({
      folderName: folder.name,
      files: (folder.files || []).map((file: any) => ({
        name: file.name,
        size: file.size,
        url: file.url
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/login', (_req: Request, res: Response) => {
  const form = `
  <h1>Login Page</h1>
  <form method="POST" action="/login">
      Email:<br><input type="email" name="email">
      <br>Password:<br><input type="password" name="password">
      <br><br><input type="submit" value="Login">
  </form>`;
  res.send(form);
});

router.get('/register', (_req: Request, res: Response) => {
  const form = `
  <h1>Register Page</h1>
  <form method="POST" action="/register">
      Username:<br><input type="text" name="username"><br>
      Email:<br><input type="email" name="email"><br>
      Password:<br><input type="password" name="password"><br>
      Confirm Password:<br><input type="password" name="confirmPassword"><br>
      <br><input type="submit" value="Register">
  </form>`;
  res.send(form);
});

router.get('/protected-route', (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.send(`
        <h1>You are authenticated</h1>
        <form method="POST" action="/logout">
            <button type="submit">Logout</button>
        </form>
    `);
  } else {
    res.send('<h1>You are not authenticated</h1><p><a href="/login">Login</a></p>');
  }
});

router.get('/login-success', (_req: Request, res: Response) => {
  res.send('<p>You successfully logged in. --> <a href="/protected-route">Go to protected route</a></p>');
});

router.get('/login-failure', (_req: Request, res: Response) => {
  res.send('Invalid email or password.');
});

export default router;
