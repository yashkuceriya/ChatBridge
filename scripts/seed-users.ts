/**
 * Seed demo users for ChatBridge.
 * Run: npx tsx scripts/seed-users.ts
 */

import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/lib/db/schema";

const DEMO_USERS = [
  { email: "student@chatbridge.edu", password: "student123", name: "Alex Student", role: "student" },
  { email: "teacher@chatbridge.edu", password: "teacher123", name: "Ms. Johnson", role: "teacher" },
  { email: "admin@chatbridge.edu", password: "admin123", name: "Admin", role: "admin" },
];

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/chatbridge",
  });
  const db = drizzle(pool, { schema });

  console.log("Seeding demo users...\n");

  for (const user of DEMO_USERS) {
    const hash = await bcrypt.hash(user.password, 10);

    try {
      await db
        .insert(schema.users)
        .values({
          email: user.email,
          name: user.name,
          passwordHash: hash,
          role: user.role,
        })
        .onConflictDoUpdate({
          target: schema.users.email,
          set: { passwordHash: hash, name: user.name, role: user.role },
        });

      console.log(`  ✓ ${user.role.padEnd(8)} ${user.email} / ${user.password}`);
    } catch (err: any) {
      console.error(`  ✗ ${user.email}: ${err.message}`);
    }
  }

  console.log("\nDone. Use these credentials to sign in.");
  await pool.end();
}

seed().catch(console.error);
