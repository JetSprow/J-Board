import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./storage/jboard.db",
});
const prisma = new PrismaClient({ adapter });

function envValue(key: string, fallback: string) {
  const value = process.env[key]?.trim();
  return value || fallback;
}

async function main() {
  const adminEmail = envValue("ADMIN_EMAIL", "admin@jboard.local").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = envValue("ADMIN_NAME", "Admin");
  const siteName = envValue("SITE_NAME", "J-Board");
  const siteUrl = process.env.NEXTAUTH_URL?.trim() || null;
  const subscriptionUrl = process.env.SUBSCRIPTION_URL?.trim() || null;
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  await prisma.appConfig.upsert({
    where: { id: "default" },
    update: {
      siteName,
      siteUrl,
      subscriptionUrl,
    },
    create: {
      id: "default",
      siteName,
      siteUrl,
      subscriptionUrl,
    },
  });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: "ADMIN",
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: adminName,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Seed completed: admin ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
