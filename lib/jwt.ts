import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'exam-secure-secret-key-do-not-expose';
const JWT_EXPIRES = '8h';

export interface JWTPayload {
  userId: string;
  username: string;
  role: 'admin' | 'center_head' | 'invigilator';
  centerId?: string;
  examId?: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
