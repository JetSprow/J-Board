import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
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
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  await prisma.appConfig.upsert({
    where: { id: "default" },
    update: {
      siteName,
      siteUrl,
    },
    create: {
      id: "default",
      siteName,
      siteUrl,
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
