import { z } from 'zod';

export const ROLES = ['admin', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const UserSchema = z.object({
	id: z.string(),
	email: z.email(),
	password: z.string().min(1),
	name: z.string(),
	role: z.enum(ROLES)
});

export type User = z.infer<typeof UserSchema>;

export const CredentialsSchema = z.object({
	email: z.email('Enter a valid email address.'),
	password: z.string().min(8, 'Password must be at least 8 characters.')
});

export type Credentials = z.infer<typeof CredentialsSchema>;
