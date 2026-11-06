import { Request, Response, NextFunction } from 'express';
import passport from 'passport';

// Session protected routes
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Please login first.' });
}

// JWT protected routes
export function requireJWT(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate('jwt', { session: false })(req, res, next);
}

// Member only routes
export function requireMember(req: Request, res: Response, next: NextFunction): void {
  if (req.user && req.user.isMember) {
    return next();
  }
  res.status(403).json({ message: 'Members only.' });
}

// Admin only routes
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  res.status(403).json({ message: 'Admins only.' });
}

// Optional JWT: non-blocking authentication for dynamic visibility
export function optionalJWT(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate('jwt', { session: false }, (_err: any, user: Express.User | false) => {
    if (user) {
      req.user = user;
    }
    next();
  })(req, res, next);
}
