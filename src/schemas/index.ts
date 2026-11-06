import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().trim().min(2, 'Username must be at least 2 characters.'),
  email: z.string().trim().email('Invalid email format.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword']
});

export const loginTokenSchema = z.object({
  email: z.string().trim().email('Invalid email format.'),
  password: z.string().min(1, 'Password is required.')
});

export const passcodeSchema = z.object({
  passcode: z.string().min(1, 'Passcode is required.')
});

export const createPostSchema = z.object({
  title: z.string().trim().min(1, 'title and content are required'),
  content: z.string().trim().min(1, 'title and content are required'),
  teamId: z.union([z.number(), z.string()]).optional().nullable().transform(val => (val !== undefined && val !== null && val !== '') ? Number(val) : null)
});

export const updatePostSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').optional(),
  content: z.string().trim().min(1, 'Content cannot be empty').optional()
});

export const createCommentSchema = z.object({
  text: z.string().trim().min(1, 'Comment text is required')
});

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required.'),
  description: z.string().trim().optional().default(''),
  password: z.string().trim().min(3, 'Team password must be at least 3 characters.')
});

export const joinTeamSchema = z.object({
  password: z.string().trim().min(1, 'Team password is required to join.')
});

export const updateTeamPasswordSchema = z.object({
  password: z.string().trim().min(3, 'Password must be at least 3 characters.')
});

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, 'Folder name is required'),
  teamId: z.union([z.number(), z.string()]).optional().nullable().transform(val => (val !== undefined && val !== null && val !== '') ? Number(val) : null)
});

export const renameFolderSchema = z.object({
  name: z.string().trim().min(1, 'Folder name is required')
});

export const shareFolderSchema = z.object({
  duration: z.union([z.literal('1d'), z.literal('7d'), z.literal('30d')], {
    error: 'Invalid duration. Must be one of: 1d, 7d, 30d'
  })
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginTokenInput = z.infer<typeof loginTokenSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type JoinTeamInput = z.infer<typeof joinTeamSchema>;
export type UpdateTeamPasswordInput = z.infer<typeof updateTeamPasswordSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type ShareFolderInput = z.infer<typeof shareFolderSchema>;
