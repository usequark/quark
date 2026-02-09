import { NextResponse } from "next/server";
import { AppError } from "@quark/core";

export function handleError(error) {
  console.error("API Error:", error);

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
    { status: 500 }
  );
}
