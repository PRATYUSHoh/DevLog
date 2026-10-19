const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { requireJWT, optionalJWT } = require('../middlewares/auth');

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: List all available engineering teams
 *     tags: [Teams]
 *     responses:
 *       200:
 *         description: List of teams without passwords
 */
router.get('/', optionalJWT, async (req, res) => {
    try {
        const teams = await prisma.team.findMany();
        const currentUserId = req.user?.id;

        const sanitized = teams.map(t => {
            const isUserMember = currentUserId && t.members ? t.members.includes(currentUserId) : false;
            const isUserOwner = currentUserId && t.ownerId === currentUserId;
            return {
                id: t.id,
                name: t.name,
                description: t.description || '',
                ownerId: t.ownerId,
                ownerUsername: t.ownerUsername || 'admin',
                memberCount: t.memberCount || 1,
                isUserMember,
                isUserOwner,
                createdAt: t.createdAt
            };
        });

        res.json(sanitized);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @swagger
 * /api/teams/{id}:
 *   get:
 *     summary: Get team details (password revealed only to team owner or admin)
 *     tags: [Teams]
 */
router.get('/:id', optionalJWT, async (req, res) => {
    try {
        const team = await prisma.team.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        const isOwnerOrAdmin = req.user && (req.user.id === team.ownerId || req.user.isAdmin);
        const isMember = req.user && team.members ? team.members.includes(req.user.id) : false;

        const payload = {
            id: team.id,
            name: team.name,
            description: team.description || '',
            ownerId: team.ownerId,
            memberCount: team.members ? team.members.length : 1,
            isUserMember: isMember,
            isUserOwner: req.user ? req.user.id === team.ownerId : false,
            createdAt: team.createdAt
        };

        if (isOwnerOrAdmin) {
            payload.password = team.password;
        }

        res.json(payload);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @swagger
 * /api/teams:
 *   post:
 *     summary: Create a new team and set its password
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', requireJWT, async (req, res) => {
    const { name, description, password } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Team name is required.' });
    }
    if (!password || password.length < 3) {
        return res.status(400).json({ error: 'Team password must be at least 3 characters.' });
    }

    try {
        const existing = await prisma.team.findUnique({ where: { name: name.trim() } });
        if (existing) {
            return res.status(400).json({ error: 'A team with this name already exists.' });
        }

        const team = await prisma.team.create({
            data: {
                name: name.trim(),
                description: description?.trim() || '',
                password: password.trim(),
                ownerId: req.user.id
            }
        });

        // Automatically assign creator to team and grant member status
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                isMember: true,
                teamId: team.id
            }
        });

        res.status(201).json({
            message: `Team "${team.name}" created successfully!`,
            team: {
                id: team.id,
                name: team.name,
                description: team.description,
                ownerId: team.ownerId,
                password: team.password
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @swagger
 * /api/teams/{id}/join:
 *   post:
 *     summary: Join a team using the team password
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/join', requireJWT, async (req, res) => {
    const teamId = parseInt(req.params.id);
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Team password is required to join.' });
    }

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        if (team.password !== password.trim()) {
            return res.status(403).json({ error: 'Incorrect team password.' });
        }

        const currentMembers = team.members || [];
        if (!currentMembers.includes(req.user.id)) {
            currentMembers.push(req.user.id);
            await prisma.team.update({
                where: { id: teamId },
                data: { members: currentMembers }
            });
        }

        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                isMember: true,
                teamId: team.id
            }
        });

        res.json({
            message: `You have joined "${team.name}"! You now have full internal attribution privileges.`,
            team: { id: team.id, name: team.name }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @swagger
 * /api/teams/{id}/leave:
 *   post:
 *     summary: Leave a team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/leave', requireJWT, async (req, res) => {
    const teamId = parseInt(req.params.id);
    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (team && team.members) {
            const updatedMembers = team.members.filter(uid => uid !== req.user.id);
            await prisma.team.update({
                where: { id: teamId },
                data: { members: updatedMembers }
            });
        }

        // Only revert isMember to false if user is not an admin
        const updateData = { teamId: null };
        if (!req.user.isAdmin) {
            updateData.isMember = false;
        }

        await prisma.user.update({
            where: { id: req.user.id },
            data: updateData
        });

        res.json({ message: 'You have left the team. You are now in Guest mode.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @swagger
 * /api/teams/{id}/password:
 *   patch:
 *     summary: Change team password (owner or admin only)
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/password', requireJWT, async (req, res) => {
    const teamId = parseInt(req.params.id);
    const { password } = req.body;

    if (!password || password.length < 3) {
        return res.status(400).json({ error: 'Password must be at least 3 characters.' });
    }

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        if (team.ownerId !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Only the team creator or an administrator can change the password.' });
        }

        await prisma.team.update({
            where: { id: teamId },
            data: { password: password.trim() }
        });

        res.json({ message: 'Team password updated successfully!' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
