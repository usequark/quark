import { NextResponse } from "next/server";
import { user, userUpdateSchema } from "@quark/db";
import { handleError } from "../../error-handler";
import { requireAuth } from "@/lib/auth-middleware";
import { validateBody } from "@quark/core";

export async function GET(request, { params }) {
  try {
    await requireAuth();
    const { id } = await params;
    const foundUser = await user.findById(id);
    if (!foundUser) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    return NextResponse.json(foundUser);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    await requireAuth();
    const { id } = await params;

    const existingUser = await user.findById(id);
    if (!existingUser) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const data = await validateBody(request, userUpdateSchema);
    const updatedUser = await user.update(id, data);
    return NextResponse.json(updatedUser);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAuth();
    const { id } = await params;

    const existingUser = await user.findById(id);
    if (!existingUser) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    await user.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
