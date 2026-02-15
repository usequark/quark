import { z } from "zod";

export const userCreateSchema = z.object({
	email: z.string().email(),
	name: z.string().optional(),
	image: z.string().url().optional(),
});

export const userRegisterSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
		.regex(/[a-z]/, "Password must contain at least one lowercase letter")
		.regex(/[0-9]/, "Password must contain at least one number"),
	name: z.string().min(2, "Name must be at least 2 characters").optional(),
});

export const userUpdateSchema = z.object({
	email: z.string().email().optional(),
	name: z.string().optional(),
	image: z.string().url().optional(),
});

export const postCreateSchema = z.object({
	title: z.string().min(1, "Title is required"),
	content: z.string().optional(),
	published: z.boolean().optional(),
});

export const postUpdateSchema = z.object({
	title: z.string().min(1, "Title is required").optional(),
	content: z.string().optional(),
	published: z.boolean().optional(),
});
