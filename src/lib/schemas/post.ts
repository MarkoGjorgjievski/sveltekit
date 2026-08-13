import { z } from 'zod';

export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

const TranslationSchema = z.object({
	title: z.string().min(1),
	excerpt: z.string(),
	body: z.string()
});

export const PostSchema = z.object({
	id: z.string(),
	slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
	translations: z.object({ en: TranslationSchema, de: TranslationSchema }),
	tags: z.array(z.string()),
	author: z.object({
		id: z.string(),
		name: z.string(),
		avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/)
	}),
	publishedAt: z.iso.datetime(),
	readingTimeMinutes: z.number().int().positive(),
	coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

export type Post = z.infer<typeof PostSchema>;
