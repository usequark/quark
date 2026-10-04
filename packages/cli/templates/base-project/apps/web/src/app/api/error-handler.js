import { AppError, createLogger } from "@usequark/quark-core";
import { NextResponse } from "next/server";

const logger = createLogger("api");

export function handleError(error) {
	logger.error("API Error", { error: error.message, stack: error.stack });

	if (error instanceof AppError) {
		return NextResponse.json(error.toJSON(), { status: error.statusCode });
	}

	// Fallback for unhandled errors
	return NextResponse.json(
		{
			name: "InternalServerError",
			message: "An unexpected error occurred",
			statusCode: 500,
			code: "INTERNAL_ERROR",
		},
		{ status: 500 },
	);
}
