import { prisma } from "./client.js";

export const user = {
  findById: (id) => {
    return prisma.user.findUnique({
      where: { id },
    });
  },
  findByEmail: (email) => {
    return prisma.user.findUnique({
      where: { email },
    });
  },
  create: (data) => {
    return prisma.user.create({
      data,
    });
  },
};

export const post = {
  create: (data) => {
    return prisma.post.create({
      data,
    });
  },
  findPublished: () => {
    return prisma.post.findMany({
      where: { published: true },
    });
  },
};
