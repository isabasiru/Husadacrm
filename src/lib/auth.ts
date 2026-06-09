import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is missing');
}
const JWT_SECRET = process.env.JWT_SECRET;

export type UserSession = {
  userId: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
};

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserSession;
    return decoded;
  } catch (error) {
    console.error('Failed to verify session token:', error);
    return null;
  }
}
