/**
 * Mock Decentralized Store — simulates IPFS-style content-addressed storage
 * In production, this would be replaced with actual IPFS or a blockchain-backed store.
 * 
 * Data is kept in-memory (server-side singleton) for the prototype.
 * For persistence across restarts, serialise to disk (JSON file approach shown below).
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), '.mock-store.json');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  passwordHash: string; // bcrypt hash
  role: 'admin' | 'center_head' | 'invigilator';
  name: string;
  centerId?: string;
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
  status: 'scheduled' | 'window_open' | 'decrypted' | 'expired';
  signatures: {
    centerHead: boolean;
    centerHeadAt?: string;
    invigilator: boolean;
    invigilatorAt?: string;
  };
  decryptedContent?: string; // Only populated after successful multi-sig + time-lock
  uploadedBy: string;        // admin user id
  originalFilename?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: 'exam_decrypted';
  examId: string;
  examTitle: string;
  subject: string;
  decryptedBy: string;
  decryptedByRole: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface StoreData {
  users: User[];
  exams: ExamRecord[];
  notifications: NotificationRecord[];
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
  };
}

// ─── Store Implementation ─────────────────────────────────────────────────────

class MockStore {
  private data: StoreData;

  constructor() {
    this.data = this.load();
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw) as Partial<StoreData>;
        return {
          users: parsed.users ?? getDefaultData().users,
          exams: parsed.exams ?? [],
          notifications: parsed.notifications ?? [],
        };
      }
    } catch {
      // Corrupt file — reset
    }
    const defaults = getDefaultData();
    this.save(defaults);
    return defaults;
  }

  private save(data?: StoreData): void {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data ?? this.data, null, 2), 'utf8');
  }

  // Users
  getUsers(): User[] { return this.data.users; }
  getUserById(id: string): User | undefined { return this.data.users.find(u => u.id === id); }
  getUserByUsername(username: string): User | undefined {
    return this.data.users.find(u => u.username === username);
  }

  // Exams
  getExams(): ExamRecord[] { return this.data.exams; }
  getExamById(id: string): ExamRecord | undefined { return this.data.exams.find(e => e.id === id); }

  addExam(exam: ExamRecord): void {
    this.data.exams.push(exam);
    this.save();
  }

  updateExam(id: string, updates: Partial<ExamRecord>): ExamRecord | null {
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

    let status = exam.status;
    if (expired) status = 'expired';
    else if (windowOpen && exam.signatures.centerHead && exam.signatures.invigilator) status = 'decrypted';
    else if (windowOpen) status = 'window_open';
    else status = 'scheduled';

    return { status, minutesUntilExam: diffMin, windowOpen, expired };
  }

  // Notifications
  addNotification(notification: NotificationRecord): void {
    this.data.notifications.unshift(notification);
    this.save();
  }

  getNotificationsForUser(userId: string): NotificationRecord[] {
    return this.data.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getUnreadNotificationCount(userId: string): number {
    return this.data.notifications.filter(n => n.userId === userId && !n.read).length;
  }

  markNotificationRead(id: string, userId: string): boolean {
    const notification = this.data.notifications.find(n => n.id === id && n.userId === userId);
    if (!notification || notification.read) return false;
    notification.read = true;
    this.save();
    return true;
  }

  markAllNotificationsRead(userId: string): void {
    let changed = false;
    for (const notification of this.data.notifications) {
      if (notification.userId === userId && !notification.read) {
        notification.read = true;
        changed = true;
      }
    }
    if (changed) this.save();
  }

  reset(): void {
    this.data = getDefaultData();
    this.save();
  }
}

// Singleton
let storeInstance: MockStore | null = null;

export function getStore(): MockStore {
  if (!storeInstance) {
    storeInstance = new MockStore();
  }
  return storeInstance;
}
