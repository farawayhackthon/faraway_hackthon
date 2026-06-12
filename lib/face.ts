import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'exam-secure-secret-key-do-not-expose';

/**
 * Threshold for euclidean distance between face descriptors.
 * Lower = stricter. 0.6 is the standard recommendation for face-api.js
 * with real-world webcam conditions (varying lighting, angles).
 */
const FACE_MATCH_THRESHOLD = 0.6;

export interface FaceVerificationPayload {
  userId: string;
  examId: string;
  purpose: 'decrypt';
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function facesMatch(stored: number[], candidate: number[]): { match: boolean; distance: number } {
  const distance = euclideanDistance(stored, candidate);
  return { match: distance <= FACE_MATCH_THRESHOLD, distance };
}

/**
 * Average multiple 128-dim face descriptors into a single robust descriptor.
 * This reduces noise from individual captures (different lighting, micro-expressions).
 */
export function averageDescriptors(descriptors: number[][]): number[] {
  if (descriptors.length === 0) throw new Error('No descriptors to average');
  if (descriptors.length === 1) return descriptors[0];

  const dim = descriptors[0].length;
  const avg = new Array(dim).fill(0);

  for (const desc of descriptors) {
    if (desc.length !== dim) throw new Error('Descriptor dimension mismatch');
    for (let i = 0; i < dim; i++) {
      avg[i] += desc[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    avg[i] /= descriptors.length;
  }

  return avg;
}

export function signFaceVerificationToken(userId: string, examId: string): string {
  const payload: FaceVerificationPayload = { userId, examId, purpose: 'decrypt' };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '3m' });
}

export function verifyFaceVerificationToken(
  token: string,
  userId: string,
  examId: string,
): FaceVerificationPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as FaceVerificationPayload;
    if (payload.purpose !== 'decrypt') return null;
    if (payload.userId !== userId || payload.examId !== examId) return null;
    return payload;
  } catch {
    return null;
  }
}
