const bcrypt = require('bcryptjs');

function createMockPrisma() {
    let nextUserId = 4;
    let nextPostId = 3;
    let nextCommentId = 2;
    let nextFolderId = 2;
    let nextFileId = 2;
    let nextShareId = 2;
    let nextTeamId = 2;

    const teams = [
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

    const users = [
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

    const posts = [
        {
            id: 1,
            title: 'How we handle payment retry logic at Razorpay',
            content: 'At Razorpay we use exponential backoff with jitter for transient gateway errors. This ensures downstream acquirers are not overwhelmed during micro-outages while keeping checkout latency minimal for successful retries. We also monitor p99 response times and dynamically throttle retries if error thresholds exceed 5%.',
            isPublished: true,
            authorId: 1,
            createdAt: new Date('2026-09-15T14:30:00Z')
        },
        {
            id: 2,
            title: 'RFC: Migrating Session Store to Redis',
            content: 'Evaluating latency improvements of in-memory caching vs relational session stores for high-throughput microservices. Target p95 retrieval is <2ms under peak load.',
            isPublished: false,
            authorId: 2,
            createdAt: new Date('2026-09-18T11:00:00Z')
        }
    ];

    const comments = [
        {
            id: 1,
            text: 'Great breakdown! Are we also applying jitter to avoid the thundering herd problem?',
            postId: 1,
            authorId: 2,
            createdAt: new Date('2026-09-15T15:00:00Z')
        }
    ];

    const folders = [
        {
            id: 1,
            name: 'Architecture Diagrams',
            userId: 1,
            createdAt: new Date('2026-09-10T09:00:00Z')
        }
    ];

    const files = [
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

    const shareLinks = [
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
            findUnique: async ({ where }) => {
                if (where.email) return users.find(u => u.email.toLowerCase() === where.email.toLowerCase()) || null;
                if (where.id) return users.find(u => u.id === parseInt(where.id)) || null;
                if (where.username) return users.find(u => u.username === where.username) || null;
                return null;
            },
            create: async ({ data }) => {
                const user = {
                    id: nextUserId++,
                    username: data.username,
                    email: data.email,
                    hash: data.hash,
                    isMember: data.isMember ?? false,
                    isAdmin: data.isAdmin ?? false,
                    createdAt: new Date()
                };
                users.push(user);
                return { ...user };
            },
            update: async ({ where, data }) => {
                const user = users.find(u => (where.id && u.id === parseInt(where.id)) || (where.email && u.email === where.email));
                if (!user) throw { code: 'P2025', message: 'Record not found' };
                Object.assign(user, data);
                return { ...user };
            }
        },
        post: {
            findMany: async (args = {}) => {
                let result = posts.slice();
                if (args.where?.isPublished !== undefined) {
                    result = result.filter(p => p.isPublished === args.where.isPublished);
                }
                if (args.where?.authorId !== undefined) {
                    result = result.filter(p => p.authorId === args.where.authorId);
                }
                const skip = args.skip || 0;
                const limit = args.take || result.length;
                result = result.slice(skip, skip + limit);

                return result.map(p => {
                    const author = users.find(u => u.id === p.authorId);
                    const item = { id: p.id, title: p.title, content: p.content };
                    if (args.select) {
                        if (args.select.createdAt) item.createdAt = p.createdAt;
                        if (args.select.isPublished !== undefined) item.isPublished = p.isPublished;
                        if (args.select.authorId !== undefined) item.authorId = p.authorId;
                        if (args.select.author) {
                            item.author = author ? { username: author.username } : null;
                        }
                    } else {
                        item.createdAt = p.createdAt;
                        item.isPublished = p.isPublished;
                        item.authorId = p.authorId;
                        item.author = author ? { username: author.username } : null;
                    }
                    return item;
                });
            },
            findUnique: async ({ where, select }) => {
                const p = posts.find(item => item.id === parseInt(where.id));
                if (!p) return null;
                const author = users.find(u => u.id === p.authorId);
                const item = { id: p.id, title: p.title, content: p.content };
                if (select) {
                    if (select.createdAt) item.createdAt = p.createdAt;
                    if (select.isPublished) item.isPublished = p.isPublished;
                    if (select.author) {
                        item.author = author ? { username: author.username } : null;
                    }
                    if (select.authorId) item.authorId = p.authorId;
                } else {
                    item.createdAt = p.createdAt;
                    item.isPublished = p.isPublished;
                    item.authorId = p.authorId;
                    item.author = author ? { username: author.username } : null;
                }
                return item;
            },
            create: async ({ data }) => {
                const post = {
                    id: nextPostId++,
                    title: data.title,
                    content: data.content,
                    authorId: parseInt(data.authorId),
                    isPublished: data.isPublished ?? false,
                    createdAt: new Date()
                };
                posts.push(post);
                return { ...post };
            },
            update: async ({ where, data }) => {
                const post = posts.find(p => p.id === parseInt(where.id));
                if (!post) throw { code: 'P2025', message: 'Record not found' };
                Object.assign(post, data);
                return { ...post };
            },
            delete: async ({ where }) => {
                const index = posts.findIndex(p => p.id === parseInt(where.id));
                if (index === -1) throw { code: 'P2025', message: 'Record not found' };
                const deleted = posts.splice(index, 1)[0];
                return deleted;
            }
        },
        comment: {
            findMany: async ({ where, select }) => {
                const pId = parseInt(where.postId);
                const list = comments.filter(c => c.postId === pId);
                return list.map(c => {
                    const author = users.find(u => u.id === c.authorId);
                    const item = { id: c.id, text: c.text, createdAt: c.createdAt };
                    if (select?.author) {
                        item.author = author ? { username: author.username } : null;
                    }
                    return item;
                });
            },
            findUnique: async ({ where }) => {
                return comments.find(c => c.id === parseInt(where.id)) || null;
            },
            create: async ({ data }) => {
                const comment = {
                    id: nextCommentId++,
                    text: data.text,
                    postId: parseInt(data.postId),
                    authorId: parseInt(data.authorId),
                    createdAt: new Date()
                };
                comments.push(comment);
                return { ...comment };
            },
            delete: async ({ where }) => {
                const index = comments.findIndex(c => c.id === parseInt(where.id));
                if (index === -1) throw { code: 'P2025', message: 'Record not found' };
                return comments.splice(index, 1)[0];
            }
        },
        folder: {
            findMany: async ({ where, include }) => {
                const userId = parseInt(where.userId);
                const list = folders.filter(f => f.userId === userId);
                return list.map(f => {
                    const item = { ...f };
                    if (include?._count?.select?.files) {
                        const count = files.filter(file => file.folderId === f.id).length;
                        item._count = { files: count };
                    }
                    return item;
                });
            },
            findUnique: async ({ where, include }) => {
                const f = folders.find(folder => folder.id === parseInt(where.id));
                if (!f) return null;
                const item = { ...f };
                if (include?.files) {
                    item.files = files.filter(file => file.folderId === f.id);
                }
                return item;
            },
            create: async ({ data }) => {
                const folder = {
                    id: nextFolderId++,
                    name: data.name,
                    userId: parseInt(data.userId),
                    createdAt: new Date()
                };
                folders.push(folder);
                return { ...folder };
            },
            update: async ({ where, data }) => {
                const folder = folders.find(f => f.id === parseInt(where.id));
                if (!folder) throw { code: 'P2025', message: 'Record not found' };
                Object.assign(folder, data);
                return { ...folder };
            },
            delete: async ({ where }) => {
                const index = folders.findIndex(f => f.id === parseInt(where.id));
                if (index === -1) throw { code: 'P2025', message: 'Record not found' };
                return folders.splice(index, 1)[0];
            }
        },
        file: {
            findMany: async (args = {}) => {
                let list = files.slice();
                if (args.where?.uploadedBy) {
                    list = list.filter(f => f.uploadedBy === parseInt(args.where.uploadedBy));
                }
                if (args.where?.folderId) {
                    list = list.filter(f => f.folderId === parseInt(args.where.folderId));
                }
                const skip = args.skip || 0;
                const limit = args.take || list.length;
                return list.slice(skip, skip + limit);
            },
            findUnique: async ({ where }) => {
                return files.find(f => f.id === parseInt(where.id)) || null;
            },
            create: async ({ data }) => {
                const file = {
                    id: nextFileId++,
                    name: data.name,
                    mimeType: data.mimeType,
                    size: data.size,
                    url: data.url,
                    publicId: data.publicId,
                    uploadedBy: parseInt(data.uploadedBy),
                    postId: data.postId ? parseInt(data.postId) : null,
                    folderId: data.folderId ? parseInt(data.folderId) : null,
                    createdAt: new Date()
                };
                files.push(file);
                return { ...file };
            },
            delete: async ({ where }) => {
                const index = files.findIndex(f => f.id === parseInt(where.id));
                if (index === -1) throw { code: 'P2025', message: 'Record not found' };
                return files.splice(index, 1)[0];
            }
        },
        shareLink: {
            findUnique: async ({ where }) => {
                return shareLinks.find(s => s.token === where.token) || null;
            },
            create: async ({ data }) => {
                const link = {
                    id: nextShareId++,
                    token: data.token,
                    folderId: parseInt(data.folderId),
                    expiresAt: new Date(data.expiresAt),
                    createdAt: new Date()
                };
                shareLinks.push(link);
                return { ...link };
            }
        },
        team: {
            findMany: async (args = {}) => {
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
            findUnique: async ({ where }) => {
                if (where.id) return teams.find(t => t.id === parseInt(where.id)) || null;
                if (where.name) return teams.find(t => t.name.toLowerCase() === where.name.toLowerCase()) || null;
                return null;
            },
            create: async ({ data }) => {
                const team = {
                    id: nextTeamId++,
                    name: data.name,
                    description: data.description || '',
                    password: data.password,
                    ownerId: parseInt(data.ownerId),
                    createdAt: new Date(),
                    members: [parseInt(data.ownerId)]
                };
                teams.push(team);
                return { ...team };
            },
            update: async ({ where, data }) => {
                const team = teams.find(t => t.id === parseInt(where.id));
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
const isDummyLocalhost = !dbUrl || dbUrl.includes('localhost:5432') || dbUrl.includes('127.0.0.1:5432');

let prisma;
if (!isDummyLocalhost) {
    try {
        const { PrismaClient } = require('@prisma/client');
        const { PrismaPg } = require('@prisma/adapter-pg');
        const adapter = new PrismaPg({ connectionString: dbUrl });
        prisma = new PrismaClient({ adapter });
    } catch (err) {
        console.warn('[AI Studio] Database connection error — falling back to mock:', err.message);
        prisma = createMockPrisma();
    }
} else {
    console.log('[DevLog] Mock database active with demo credentials (sandbox mode)');
    prisma = createMockPrisma();
}

module.exports = prisma;