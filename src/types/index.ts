export interface AuthUser {
  id: number;
  username: string;
  email: string;
  isMember: boolean;
  isAdmin: boolean;
  teamId?: number | null;
  hash?: string;
  createdAt?: Date;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      user?: AuthUser;
    }
  }
}
