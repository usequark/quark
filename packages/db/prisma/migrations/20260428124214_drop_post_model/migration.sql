/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE IF EXISTS "Post" DROP CONSTRAINT IF EXISTS "Post_authorId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Post";
