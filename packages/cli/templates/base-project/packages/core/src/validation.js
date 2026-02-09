import { ZodError } from "zod";
import { ValidationError } from "./errors.js";

/**
 * Validates request body against a Zod schema
 * @param {Request} request - Next.js Request object
 * @param {import("zod").ZodSchema} schema - Zod schema to validate against
 * @returns {Promise<any>} - Validated data
 */
export async function validateBody(request, schema) {
	let body;
	try {
		body = await request.json();
	} catch (_err) {
		throw new ValidationError("Invalid JSON body");
	}

	try {
		return schema.parse(body);
	} catch (error) {
		if (error instanceof ZodError) {
			throw new ValidationError("Validation failed", error.errors);
		}
		throw error;
	}
}
