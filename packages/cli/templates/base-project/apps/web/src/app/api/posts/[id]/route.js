import { NextResponse } from "next/server";
import { post, postUpdateSchema } from "@quark/db";
import { handleError } from "../../error-handler";
import { requireAuth } from "@/lib/auth-middleware";
import { validateBody, UnauthorizedError } from "@quark/core";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const foundPost = await post.findById(id);
    if (!foundPost) {
        return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }
    return NextResponse.json(foundPost);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    
    const foundPost = await post.findById(id);
    if (!foundPost) {
        return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }
    
    if (foundPost.authorId !== session.user.id) {
        throw new UnauthorizedError("You can only edit your own posts");
    }

    const data = await validateBody(request, postUpdateSchema);
    const updatedPost = await post.update(id, data);
    return NextResponse.json(updatedPost);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    
    const foundPost = await post.findById(id);
    if (!foundPost) {
        return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }
    
    if (foundPost.authorId !== session.user.id) {
        throw new UnauthorizedError("You can only delete your own posts");
    }

    await post.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
