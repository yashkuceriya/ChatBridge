import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.CAPABILITY_TOKEN_SECRET || "chatbridge-dev-secret-change-me"
);

export async function createCapabilityToken(payload: {
  appSessionId: string;
  appId: string;
  userId: string;
  permissions: string[];
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m") // Short-lived
    .setSubject(payload.appSessionId)
    .sign(SECRET);
}

export async function verifyCapabilityToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as {
      appSessionId: string;
      appId: string;
      userId: string;
      permissions: string[];
    };
  } catch {
    return null;
  }
}
