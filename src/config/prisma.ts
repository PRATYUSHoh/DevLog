import bcrypt from 'bcryptjs';

export interface UserRecord {
  id: number;
  username: string;
  email: string;
  hash: string;
  isMember: boolean;
  isAdmin: boolean;
  teamId?: number | null;
  createdAt: Date;
}

export interface PostRecord {
  id: number;
  title: string;
  content: string;
  isPublished: boolean;
  authorId: number;
  teamId?: number | null;
  createdAt: Date;
}

export interface CommentRecord {
  id: number;
  text: string;
  postId: number;
  authorId: number;
  createdAt: Date;
}

export interface FolderRecord {
  id: number;
  name: string;
  userId: number;
  teamId?: number | null;
  createdAt: Date;
}

export interface FileRecord {
  id: number;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  publicId: string;
  uploadedBy: number;
  postId?: number | null;
  folderId?: number | null;
  createdAt: Date;
}

export interface ShareLinkRecord {
  id: number;
  token: string;
  folderId: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface TeamRecord {
  id: number;
  name: string;
  description: string;
  password?: string;
  ownerId: number;
  createdAt: Date;
  members: number[];
}

export interface PrismaMock {
  user: any;
  post: any;
  comment: any;
  folder: any;
  file: any;
  shareLink: any;
  team: any;
}

function createMockPrisma(): PrismaMock {
  let nextUserId = 4;
  let nextPostId = 3;
  let nextCommentId = 2;
  let nextFolderId = 2;
  let nextFileId = 2;
  let nextShareId = 2;
  let nextTeamId = 2;

  const teams: TeamRecord[] = [
    {
      id: 1,
      name: 'Core Engineering',
      description: 'Primary engineering team maintaining backend infrastructure and APIs.',
      password: 'devteam123',
      ownerId: 1,
      createdAt: new Date('2026-09-01T10:00:00Z'),
      members: [1, 2, 3]
    }
  ];

  const users: UserRecord[] = [
    {
      id: 1,
      username: 'admin',
      email: 'admin@devlog.com',
      hash: bcrypt.hashSync('admin1234', 10),
      isMember: true,
      isAdmin: true,
      teamId: 1,
      createdAt: new Date('2026-09-01T10:00:00Z')
    },
    {
      id: 2,
      username: 'demo_member',
      email: 'demo@devlog.com',
      hash: bcrypt.hashSync('demo1234', 10),
      isMember: true,
      isAdmin: false,
      teamId: 1,
      createdAt: new Date('2026-09-05T12:00:00Z')
    },
    {
      id: 3,
      username: 'pratyush',
      email: 'prat@gmail.com',
      hash: bcrypt.hashSync('12345678', 10),
      isMember: true,
      isAdmin: true,
      teamId: 1,
      createdAt: new Date('2026-09-01T10:00:00Z')
    }
  ];

  const posts: PostRecord[] = [
    {
      id: 1,
      title: 'How we handle payment retry logic at Razorpay',
      content: 'At Razorpay we use exponential backoff with jitter for transient gateway errors. This ensures downstream acquirers are not overwhelmed during micro-outages while keeping checkout latency minimal for successful retries. We also monitor p99 response times and dynamically throttle retries if error thresholds exceed 5%.',
      isPublished: true,
      authorId: 1,
      teamId: 1,
      createdAt: new Date('2026-09-15T14:30:00Z')
    },
    {
      id: 2,
      title: 'RFC: Migrating Session Store to Redis',
      content: 'Evaluating latency improvements of in-memory caching vs relational session stores for high-throughput microservices. Target p95 retrieval is <2ms under peak load.',
      isPublished: false,
      authorId: 2,
      teamId: 1,
      createdAt: new Date('2026-09-18T11:00:00Z')
    }
  ];

  const comments: CommentRecord[] = [
    {
      id: 1,
      text: 'Great breakdown! Are we also applying jitter to avoid the thundering herd problem?',
      postId: 1,
      authorId: 2,
      createdAt: new Date('2026-09-15T15:00:00Z')
    }
  ];

  const folders: FolderRecord[] = [
    {
      id: 1,
      name: 'Architecture Diagrams',
      userId: 1,
      teamId: 1,
      createdAt: new Date('2026-09-10T09:00:00Z')
    }
  ];

  const files: FileRecord[] = [
    {
      id: 1,
      name: 'payment-architecture.png',
      mimeType: 'image/png',
      size: 245000,
      url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
      publicId: 'mock_payment_arch',
      uploadedBy: 1,
      postId: 1,
      folderId: 1,
      createdAt: new Date('2026-09-10T10:00:00Z')
    }
  ];

  const shareLinks: ShareLinkRecord[] = [
    {
      id: 1,
      token: 'demo-share-token-devlog-2026',
      folderId: 1,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date('2026-09-10T10:00:00Z')
    }
  ];

  return {
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: number | string; username?: string } }) => {
        if (where.email) return users.find(u => u.email.toLowerCase() === where.email!.toLowerCase()) || null;
        if (where.id) return users.find(u => u.id === Number(where.id)) || null;
        if (where.username) return users.find(u => u.username === where.username) || null;
        return null;
      },
      create: async ({ data }: { data: Partial<UserRecord> }) => {
        const user: UserRecord = {
          id: nextUserId++,
          username: data.username || `user_${nextUserId}`,
          email: data.email || '',
          hash: data.hash || '',
          isMember: data.isMember ?? false,
          isAdmin: data.isAdmin ?? false,
          createdAt: new Date()
        };
        users.push(user);
        return { ...user };
      },
      update: async ({ where, data }: { where: { id?: number | string; email?: string }; data: Partial<UserRecord> }) => {
        const user = users.find(u => (where.id && u.id === Number(where.id)) || (where.email && u.email === where.email));
        if (!user) throw { code: 'P2025', message: 'Record not found' };
        Object.assign(user, data);
        return { ...user };
      }
    },
    post: {
      findMany: async (args: any = {}) => {
        let result = posts.slice();
        if (args.where?.isPublished !== undefined) {
          result = result.filter(p => p.isPublished === args.where.isPublished);
        }
        if (args.where?.authorId !== undefined) {
          result = result.filter(p => p.authorId === args.where.authorId);
        }
        if (args.where?.teamId !== undefined) {
          result = result.filter(p => p.teamId === args.where.teamId);
        }
        const skip = args.skip || 0;
        const limit = args.take || result.length;
        result = result.slice(skip, skip + limit);

        return result.map(p => {
          const author = users.find(u => u.id === p.authorId);
          const team = p.teamId ? teams.find(t => t.id === p.teamId) : null;
          const item: any = { id: p.id, title: p.title, content: p.content, teamId: p.teamId || null };
          if (args.select) {
            if (args.select.createdAt) item.createdAt = p.createdAt;
            if (args.select.isPublished !== undefined) item.isPublished = p.isPublished;
            if (args.select.authorId !== undefined) item.authorId = p.authorId;
            if (args.select.teamId !== undefined) item.teamId = p.teamId || null;
            if (args.select.team) {
              item.team = team ? { id: team.id, name: team.name } : null;
            }
            if (args.select.author) {
              item.author = author ? { username: author.username } : null;
            }
          } else {
            item.createdAt = p.createdAt;
            item.isPublished = p.isPublished;
            item.authorId = p.authorId;
            item.author = author ? { username: author.username } : null;
            item.team = team ? { id: team.id, name: team.name } : null;
          }
          return item;
        });
      },
      findUnique: async ({ where, select }: { where: { id: number | string }; select?: any }) => {
        const p = posts.find(item => item.id === Number(where.id));
        if (!p) return null;
        const author = users.find(u => u.id === p.authorId);
        const team = p.teamId ? teams.find(t => t.id === p.teamId) : null;
        const item: any = { id: p.id, title: p.title, content: p.content, teamId: p.teamId || null };
        if (select) {
          if (select.createdAt) item.createdAt = p.createdAt;
          if (select.isPublished) item.isPublished = p.isPublished;
          if (select.author) {
            item.author = author ? { username: author.username } : null;
          }
          if (select.authorId) item.authorId = p.authorId;
          if (select.teamId !== undefined) item.teamId = p.teamId || null;
          if (select.team) {
            item.team = team ? { id: team.id, name: team.name } : null;
          }
        } else {
          item.createdAt = p.createdAt;
          item.isPublished = p.isPublished;
          item.authorId = p.authorId;
          item.author = author ? { username: author.username } : null;
          item.team = team ? { id: team.id, name: team.name } : null;
        }
        return item;
      },
      create: async ({ data }: { data: any }) => {
        const post: PostRecord = {
          id: nextPostId++,
          title: data.title,
          content: data.content,
          authorId: Number(data.authorId),
          teamId: data.teamId ? Number(data.teamId) : null,
          isPublished: data.isPublished ?? false,
          createdAt: new Date()
        };
        posts.push(post);
        return { ...post };
      },
      update: async ({ where, data }: { where: { id: number | string }; data: any }) => {
        const post = posts.find(p => p.id === Number(where.id));
        if (!post) throw { code: 'P2025', message: 'Record not found' };
        Object.assign(post, data);
        return { ...post };
      },
      delete: async ({ where }: { where: { id: number | string } }) => {
        const index = posts.findIndex(p => p.id === Number(where.id));
        if (index === -1) throw { code: 'P2025', message: 'Record not found' };
        return posts.splice(index, 1)[0];
      }
    },
    comment: {
      findMany: async ({ where, select }: { where: { postId: number | string }; select?: any }) => {
        const pId = Number(where.postId);
        const list = comments.filter(c => c.postId === pId);
        return list.map(c => {
          const author = users.find(u => u.id === c.authorId);
          const item: any = { id: c.id, text: c.text, createdAt: c.createdAt };
          if (select?.author) {
            item.author = author ? { username: author.username } : null;
          }
          return item;
        });
      },
      findUnique: async ({ where }: { where: { id: number | string } }) => {
        return comments.find(c => c.id === Number(where.id)) || null;
      },
      create: async ({ data }: { data: any }) => {
        const comment: CommentRecord = {
          id: nextCommentId++,
          text: data.text,
          postId: Number(data.postId),
          authorId: Number(data.authorId),
          createdAt: new Date()
        };
        comments.push(comment);
        return { ...comment };
      },
      delete: async ({ where }: { where: { id: number | string } }) => {
        const index = comments.findIndex(c => c.id === Number(where.id));
        if (index === -1) throw { code: 'P2025', message: 'Record not found' };
        return comments.splice(index, 1)[0];
      }
    },
    folder: {
      findMany: async ({ where, include }: { where?: any; include?: any } = {}) => {
        const userId = where?.userId ? Number(where.userId) : null;
        const teamId = where?.teamId ? Number(where.teamId) : null;
        let list = folders.slice();
        if (userId && teamId) {
          list = list.filter(f => f.userId === userId || f.teamId === teamId);
        } else if (userId) {
          list = list.filter(f => f.userId === userId);
        } else if (teamId) {
          list = list.filter(f => f.teamId === teamId);
        }
        return list.map(f => {
          const team = f.teamId ? teams.find(t => t.id === f.teamId) : null;
          const item: any = { ...f, team: team ? { id: team.id, name: team.name } : null };
          if (include?._count?.select?.files) {
            const count = files.filter(file => file.folderId === f.id).length;
            item._count = { files: count };
          }
          return item;
        });
      },
      findUnique: async ({ where, include }: { where: { id: number | string }; include?: any }) => {
        const f = folders.find(folder => folder.id === Number(where.id));
        if (!f) return null;
        const team = f.teamId ? teams.find(t => t.id === f.teamId) : null;
        const item: any = { ...f, team: team ? { id: team.id, name: team.name } : null };
        if (include?.files) {
          item.files = files.filter(file => file.folderId === f.id);
        }
        return item;
      },
      create: async ({ data }: { data: any }) => {
        const folder: FolderRecord = {
          id: nextFolderId++,
          name: data.name,
          userId: Number(data.userId),
          teamId: data.teamId ? Number(data.teamId) : null,
          createdAt: new Date()
        };
        folders.push(folder);
        return { ...folder };
      },
      update: async ({ where, data }: { where: { id: number | string }; data: any }) => {
        const folder = folders.find(f => f.id === Number(where.id));
        if (!folder) throw { code: 'P2025', message: 'Record not found' };
        Object.assign(folder, data);
        return { ...folder };
      },
      delete: async ({ where }: { where: { id: number | string } }) => {
        const index = folders.findIndex(f => f.id === Number(where.id));
        if (index === -1) throw { code: 'P2025', message: 'Record not found' };
        return folders.splice(index, 1)[0];
      }
    },
    file: {
      findMany: async (args: any = {}) => {
        let list = files.slice();
        if (args.where?.uploadedBy) {
          list = list.filter(f => f.uploadedBy === Number(args.where.uploadedBy));
        }
        if (args.where?.folderId) {
          list = list.filter(f => f.folderId === Number(args.where.folderId));
        }
        const skip = args.skip || 0;
        const limit = args.take || list.length;
        return list.slice(skip, skip + limit);
      },
      findUnique: async ({ where }: { where: { id: number | string } }) => {
        return files.find(f => f.id === Number(where.id)) || null;
      },
      create: async ({ data }: { data: any }) => {
        const file: FileRecord = {
          id: nextFileId++,
          name: data.name,
          mimeType: data.mimeType,
          size: data.size,
          url: data.url,
          publicId: data.publicId,
          uploadedBy: Number(data.uploadedBy),
          postId: data.postId ? Number(data.postId) : null,
          folderId: data.folderId ? Number(data.folderId) : null,
          createdAt: new Date()
        };
        files.push(file);
        return { ...file };
      },
      delete: async ({ where }: { where: { id: number | string } }) => {
        const index = files.findIndex(f => f.id === Number(where.id));
        if (index === -1) throw { code: 'P2025', message: 'Record not found' };
        return files.splice(index, 1)[0];
      }
    },
    shareLink: {
      findUnique: async ({ where }: { where: { token: string } }) => {
        return shareLinks.find(s => s.token === where.token) || null;
      },
      create: async ({ data }: { data: any }) => {
        const link: ShareLinkRecord = {
          id: nextShareId++,
          token: data.token,
          folderId: Number(data.folderId),
          expiresAt: new Date(data.expiresAt),
          createdAt: new Date()
        };
        shareLinks.push(link);
        return { ...link };
      }
    },
    team: {
      findMany: async () => {
        return teams.map(t => {
          const owner = users.find(u => u.id === t.ownerId);
          return {
            id: t.id,
            name: t.name,
            description: t.description || '',
            ownerId: t.ownerId,
            ownerUsername: owner ? owner.username : 'admin',
            memberCount: t.members ? t.members.length : 1,
            members: t.members || [],
            createdAt: t.createdAt
          };
        });
      },
      findUnique: async ({ where }: { where: { id?: number | string; name?: string } }) => {
        if (where.id) return teams.find(t => t.id === Number(where.id)) || null;
        if (where.name) return teams.find(t => t.name.toLowerCase() === where.name!.toLowerCase()) || null;
        return null;
      },
      create: async ({ data }: { data: any }) => {
        const team: TeamRecord = {
          id: nextTeamId++,
          name: data.name,
          description: data.description || '',
          password: data.password,
          ownerId: Number(data.ownerId),
          createdAt: new Date(),
          members: [Number(data.ownerId)]
        };
        teams.push(team);
        return { ...team };
      },
      update: async ({ where, data }: { where: { id: number | string }; data: any }) => {
        const team = teams.find(t => t.id === Number(where.id));
        if (!team) throw { code: 'P2025', message: 'Record not found' };
        if (data.name !== undefined) team.name = data.name;
        if (data.description !== undefined) team.description = data.description;
        if (data.password !== undefined) team.password = data.password;
        if (data.members !== undefined) team.members = data.members;
        return { ...team };
      }
    }
  };
}

const dbUrl = process.env.DATABASE_URL;

let prisma: any;
if (dbUrl && process.env.USE_MOCK_DB !== 'true') {
  try {
    const { PrismaClient } = require('@prisma/client');
    const { PrismaPg } = require('@prisma/adapter-pg');
    const adapter = new PrismaPg({ connectionString: dbUrl });
    prisma = new PrismaClient({ adapter });
  } catch (err: any) {
    console.warn('[DevLog] Database connection error — falling back to mock:', err.message);
    prisma = createMockPrisma();
  }
} else {
  prisma = createMockPrisma();
}

export default prisma;
