import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import prisma from './prisma';
import { validPassword } from '../lib/passwordUtils';

passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email: string, password: string, done: (err: any, user?: any, info?: any) => void) => {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return done(null, false, { message: 'Invalid email or password.' });
      const isValid = await validPassword(password, user.hash);
      if (isValid) return done(null, user);
      return done(null, false, { message: 'Invalid email or password.' });
    } catch (err) {
      return done(err);
    }
  }
));

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'devlog-jwt-secret-key-12345'
};

passport.use(new JwtStrategy(jwtOptions, async (payload: any, done: (err: any, user?: any) => void) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return done(null, false);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
