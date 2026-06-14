/**
 * Mock Decentralized Store — simulates IPFS-style content-addressed storage
 * In production, this would be replaced with actual IPFS or a blockchain-backed store.
 * 
 * Data is kept in-memory (server-side singleton) for the prototype.
 * For persistence across restarts, serialise to disk (JSON file approach shown below).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

function getStoragePath(): string {
  const isServerless = 
    process.env.VERCEL || 
    process.env.AWS_LAMBDA_FUNCTION_NAME || 
    process.env.LAMBDA_TASK_ROOT || 
    process.env.NETLIFY ||
    process.env.NODE_ENV === 'production';

  if (isServerless) {
    return path.join(os.tmpdir(), '.mock-store.json');
  }

  const localPath = path.join(process.cwd(), '.mock-store.json');
  return localPath;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  passwordHash: string; // bcrypt hash
  role: 'admin' | 'center_head' | 'invigilator';
  name: string;
  centerId?: string;
  faceDescriptor?: number[]; // 128-dim face embedding for biometric verification
  faceEnrolledAt?: string;
  passwordPlain?: string; // prototype-only credential for admin-created staff
}

export interface ExamRecord {
  id: string;
  title: string;
  subject: string;
  examTime: string;         // ISO 8601
  centerHeadId: string;
  invigilatorId: string;
  encryptedPayload: string; // base64 AES-GCM ciphertext (simulated IPFS CID content)
  salt: string;             // PBKDF2 salt
  encryptedKey: string;     // The AES key is itself encrypted and stored separately
  keySalt: string;
  uploadedAt: string;
  status: 'scheduled' | 'window_open' | 'ready_to_decrypt' | 'decrypted' | 'expired';
  signatures: {
    centerHead: boolean;
    centerHeadAt?: string;
    invigilator: boolean;
    invigilatorAt?: string;
  };
  decryptedContent?: string; // Only populated after successful multi-sig + time-lock
  uploadedBy: string;        // admin user id
  originalFilename?: string;
  releaseAudit?: {
    decryptedAt: string;
    decryptedBy: string;
    decryptedByRole: string;
    decryptedById: string;
    faceVerifiedAt: string;
    traceId: string;
    centerId?: string;
  };
  printCount?: number;
}

export type AuditEventType =
  | 'exam_uploaded'
  | 'signature_center_head'
  | 'signature_invigilator'
  | 'face_enrolled'
  | 'face_verified'
  | 'face_verification_failed'
  | 'exam_decrypted'
  | 'exam_viewed'
  | 'exam_printed';

export interface AuditLogEntry {
  id: string;
  examId?: string;
  examTitle?: string;
  event: AuditEventType;
  actorId: string;
  actorName: string;
  actorRole: string;
  message: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: 'exam_decrypted' | 'staff_created' | 'face_enrolled' | 'face_reset';
  examId?: string;
  examTitle?: string;
  subject?: string;
  decryptedBy?: string;
  decryptedByRole?: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface StoreData {
  users: User[];
  exams: ExamRecord[];
  notifications: NotificationRecord[];
  auditLogs: AuditLogEntry[];
}

// ─── Default Seed Data ────────────────────────────────────────────────────────

function getDefaultData(): StoreData {
  return {
    users: [
      {
        id: 'user-admin-001',
        username: 'admin',
        // Password: Admin@123
        passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oR5K1.Bca',
        role: 'admin',
        name: 'Dr. Rajesh Kumar (Exam Board)',
      },
      {
        id: 'user-ch-001',
        username: 'centerhead',
        // Password: Center@123
        passwordHash: '$2a$12$YYnr76blgqVHnEzKjuopQ.lX3VBW/H5K7Ul8HJbMNyV6bEjz6O4..',
        role: 'center_head',
        name: 'Prof. Anita Sharma (Center Head)',
        centerId: 'center-001',
      },
      {
        id: 'user-inv-001',
        username: 'invigilator',
        // Password: Invigil@123
        passwordHash: '$2a$12$dYt4f6WN8UoB3v2kHmP5S.h7z4T2ixiRG5BbYRQ8pBN9fBUNpLPOm',
        role: 'invigilator',
        name: 'Mr. Vikram Singh (Invigilator)',
        centerId: 'center-001',
      },
    ],
    exams: [],
    notifications: [],
    auditLogs: [],
  };
}

// ─── Store Implementation ─────────────────────────────────────────────────────

class MockStore {
  private data: StoreData;
  private lastMtime: number = 0;

  constructor() {
    this.data = this.load();
  }

  private sync(): void {
    const dbPath = getStoragePath();
    try {
      const stats = fs.statSync(dbPath);
      if (stats.mtimeMs > this.lastMtime) {
        this.data = this.load();
      }
    } catch {
      // Ignore stat errors
    }
  }

  private load(): StoreData {
    const dbPath = getStoragePath();
    try {
      if (fs.existsSync(dbPath)) {
        const raw = fs.readFileSync(dbPath, 'utf8');
        try {
          const parsed = JSON.parse(raw) as Partial<StoreData>;
          this.lastMtime = fs.statSync(dbPath).mtimeMs;
          return {
            users: parsed.users ?? getDefaultData().users,
            exams: parsed.exams ?? [],
            notifications: parsed.notifications ?? [],
            auditLogs: parsed.auditLogs ?? [],
          };
        } catch (parseErr) {
          console.error('JSON Parse error on mock database. Returning in-memory data to avoid wipe.', parseErr);
          return this.data || getDefaultData();
        }
      }
    } catch {
      // Ignored
    }
    const defaults = getDefaultData();
    this.save(defaults);
    return defaults;
  }

  private save(data?: StoreData): void {
    const dbPath = getStoragePath();
    const tmpPath = dbPath + '.tmp';
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(data ?? this.data, null, 2), 'utf8');
      fs.renameSync(tmpPath, dbPath);
      this.lastMtime = fs.statSync(dbPath).mtimeMs;
    } catch (err) {
      console.error('Failed to write mock database file:', err);
    }
  }

  // Users
  getUsers(): User[] { this.sync(); return this.data.users; }
  getUserById(id: string): User | undefined { this.sync(); return this.data.users.find(u => u.id === id); }
  getUserByUsername(username: string): User | undefined {
    this.sync();
    return this.data.users.find(u => u.username === username);
  }

  updateUser(id: string, updates: Partial<User>): User | null {
    this.sync();
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.save();
    return this.data.users[idx];
  }

  addUser(user: User): User {
    this.sync();
    this.data.users.push(user);
    this.save();
    return user;
  }

  resetUserFace(id: string): User | null {
    return this.updateUser(id, {
      faceDescriptor: undefined,
      faceEnrolledAt: undefined,
    });
  }

  // Exams
  getExams(): ExamRecord[] { this.sync(); return this.data.exams; }
  getExamById(id: string): ExamRecord | undefined { this.sync(); return this.data.exams.find(e => e.id === id); }

  addExam(exam: ExamRecord): void {
    this.sync();
    this.data.exams.push(exam);
    this.save();
  }

  updateExam(id: string, updates: Partial<ExamRecord>): ExamRecord | null {
    this.sync();
    const idx = this.data.exams.findIndex(e => e.id === id);
    if (idx === -1) return null;
    this.data.exams[idx] = { ...this.data.exams[idx], ...updates };
    this.save();
    return this.data.exams[idx];
  }

  /**
   * Get exams visible to a given user (center head or invigilator sees only their assigned exams)
   */
  getExamsForUser(userId: string, role: string): ExamRecord[] {
    this.sync();
    if (role === 'admin') return this.data.exams;
    if (role === 'center_head') {
      return this.data.exams.filter(e => e.centerHeadId === userId);
    }
    if (role === 'invigilator') {
      return this.data.exams.filter(e => e.invigilatorId === userId);
    }
    return [];
  }

  /**
   * Compute live status based on current time (does NOT mutate — just returns computed status)
   */
  computeExamStatus(exam: ExamRecord): {
    status: string;
    minutesUntilExam: number;
    windowOpen: boolean;
    expired: boolean;
  } {
    const now = new Date();
    const examTime = new Date(exam.examTime);
    const diffMs = examTime.getTime() - now.getTime();
    const diffMin = diffMs / 60000;

    const windowOpen = diffMin <= 5 && diffMin >= -30; // window: 5 min before to 30 min after
    const expired = diffMin < -30;

    const bothSigned = exam.signatures.centerHead && exam.signatures.invigilator;
    let status = exam.status;
    if (expired) status = 'expired';
    else if (exam.decryptedContent) status = 'decrypted';
    else if (windowOpen && bothSigned) status = 'ready_to_decrypt';
    else if (windowOpen) status = 'window_open';
    else status = 'scheduled';

    return { status, minutesUntilExam: diffMin, windowOpen, expired };
  }

  // Notifications
  addNotification(notification: NotificationRecord): void {
    this.sync();
    this.data.notifications.unshift(notification);
    this.save();
  }

  getNotificationsForUser(userId: string): NotificationRecord[] {
    this.sync();
    return this.data.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getUnreadNotificationCount(userId: string): number {
    this.sync();
    return this.data.notifications.filter(n => n.userId === userId && !n.read).length;
  }

  markNotificationRead(id: string, userId: string): boolean {
    this.sync();
    const notification = this.data.notifications.find(n => n.id === id && n.userId === userId);
    if (!notification || notification.read) return false;
    notification.read = true;
    this.save();
    return true;
  }

  markAllNotificationsRead(userId: string): void {
    this.sync();
    let changed = false;
    for (const notification of this.data.notifications) {
      if (notification.userId === userId && !notification.read) {
        notification.read = true;
        changed = true;
      }
    }
    if (changed) this.save();
  }

  // Audit logs
  addAuditLog(entry: AuditLogEntry): void {
    this.sync();
    this.data.auditLogs.unshift(entry);
    this.save();
  }

  getAuditLogs(): AuditLogEntry[] {
    this.sync();
    return [...this.data.auditLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  getAuditLogsForExam(examId: string): AuditLogEntry[] {
    return this.getAuditLogs().filter(e => e.examId === examId);
  }

  /** Remove expired demo exams to keep the store usable for live testing */
  pruneExpiredDemoExams(): number {
    this.sync();
    const before = this.data.exams.length;
    const expiredIds = new Set<string>();

    this.data.exams = this.data.exams.filter(exam => {
      if (!exam.title.startsWith('[DEMO]')) return true;
      if (this.computeExamStatus(exam).expired) {
        expiredIds.add(exam.id);
        return false;
      }
      return true;
    });

    if (expiredIds.size > 0) {
      this.data.notifications = this.data.notifications.filter(n => !n.examId || !expiredIds.has(n.examId));
      this.save();
    } else if (this.data.exams.length !== before) {
      this.save();
    }

    return before - this.data.exams.length;
  }

  reset(): void {
    this.data = getDefaultData();
    this.save();
  }
}

// Singleton
const globalForStore = globalThis as unknown as { storeInstance: MockStore | null };

export function getStore(): MockStore {
  if (!globalForStore.storeInstance) {
    globalForStore.storeInstance = new MockStore();
  }
  return globalForStore.storeInstance;
}
