import React from "react";

export const metadata = {
  title: "TechStream Core",
  description: "A modern monorepo with Next.js, React, and Prisma",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
