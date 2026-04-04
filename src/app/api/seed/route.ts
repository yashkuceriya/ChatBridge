import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, schema } from "@/lib/db";

const DEMO_USERS = [
  { email: "student@chatbridge.edu", password: "student123", name: "Alex Student", role: "student" },
  { email: "teacher@chatbridge.edu", password: "teacher123", name: "Ms. Johnson", role: "teacher" },
  { email: "admin@chatbridge.edu", password: "admin123", name: "Admin", role: "admin" },
];

export async function POST() {
  try {
    const results = [];

    for (const user of DEMO_USERS) {
      const hash = await bcrypt.hash(user.password, 10);
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

      results.push({ email: user.email, role: user.role });
    }

    return NextResponse.json({
      success: true,
      users: results,
      message: "Demo users seeded. Student: student@chatbridge.edu/student123, Teacher: teacher@chatbridge.edu/teacher123",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
