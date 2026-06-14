import clientPromise from './mongodb';
import { v4 as uuidv4 } from 'uuid';
import { Collection, Db } from 'mongodb';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'center_head' | 'invigilator';
  name: string;
  centerId?: string;
  faceDescriptor?: number[];
  faceEnrolledAt?: string;
  passwordPlain?: string;
}

export interface ExamRecord {
  id: string;
  title: string;
  subject: string;
  examTime: string;
  centerHeadId: string;
  invigilatorId: string;
  encryptedPayload: string;
  salt: string;
  encryptedKey: string;
  keySalt: string;
  uploadedAt: string;
  status: 'scheduled' | 'window_open' | 'ready_to_decrypt' | 'decrypted' | 'expired';
  signatures: {
    centerHead: boolean;
    centerHeadAt?: string;
    invigilator: boolean;
    invigilatorAt?: string;
  };
  decryptedContent?: string;
  uploadedBy: string;
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

function getDefaultUsers(): User[] {
  return [
    {
      id: 'user-admin-001',
      username: 'admin',
      passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oR5K1.Bca',
      role: 'admin',
      name: 'Dr. Rajesh Kumar (Exam Board)',
    },
    {
      id: 'user-ch-001',
      username: 'centerhead',
      passwordHash: '$2a$12$YYnr76blgqVHnEzKjuopQ.lX3VBW/H5K7Ul8HJbMNyV6bEjz6O4..',
      role: 'center_head',
      name: 'Prof. Anita Sharma (Center Head)',
      centerId: 'center-001',
    },
    {
      id: 'user-inv-001',
      username: 'invigilator',
      passwordHash: '$2a$12$dYt4f6WN8UoB3v2kHmP5S.h7z4T2ixiRG5BbYRQ8pBN9fBUNpLPOm',
      role: 'invigilator',
      name: 'Mr. Vikram Singh (Invigilator)',
      centerId: 'center-001',
    },
    {
      id: '9d967805-4a17-4ea5-8d78-539a95350a7b',
      username: 'vedantlakhotia',
      passwordHash: '',
      passwordPlain: 'paradox',
      role: 'center_head',
      name: 'Vedant Lakhotia',
      centerId: 'center-001',
    }
  ];
}

export class MongoStore {
  private async getDb(): Promise<Db> {
    const client = await clientPromise;
    return client.db('examss_db');
  }

  private async getUsersCollection(): Promise<Collection<User>> {
    const db = await this.getDb();
    return db.collection<User>('users');
  }

  private async getExamsCollection(): Promise<Collection<ExamRecord>> {
    const db = await this.getDb();
    return db.collection<ExamRecord>('exams');
  }

  private async getNotificationsCollection(): Promise<Collection<NotificationRecord>> {
    const db = await this.getDb();
    return db.collection<NotificationRecord>('notifications');
  }

  private async getAuditLogsCollection(): Promise<Collection<AuditLogEntry>> {
    const db = await this.getDb();
    return db.collection<AuditLogEntry>('auditLogs');
  }

  async init(): Promise<void> {
    const users = await this.getUsersCollection();
    const count = await users.countDocuments();
    if (count === 0) {
      await users.insertMany(getDefaultUsers() as any);
    }
  }

  // Users
  async getUsers(): Promise<User[]> {
    const col = await this.getUsersCollection();
    const docs = await col.find({}).toArray();
    return docs.map(d => ({ ...d, _id: undefined } as any));
  }

  async getUserById(id: string): Promise<User | undefined> {
    const col = await this.getUsersCollection();
    const doc = await col.findOne({ id });
    return doc ? { ...doc, _id: undefined } as any : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const col = await this.getUsersCollection();
    const doc = await col.findOne({ username });
    return doc ? { ...doc, _id: undefined } as any : undefined;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const col = await this.getUsersCollection();
    const result = await col.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result ? { ...result, _id: undefined } as any : null;
  }

  async addUser(user: User): Promise<User> {
    const col = await this.getUsersCollection();
    await col.insertOne(user as any);
    return user;
  }

  async resetUserFace(id: string): Promise<User | null> {
    const col = await this.getUsersCollection();
    const result = await col.findOneAndUpdate(
      { id },
      { $unset: { faceDescriptor: "", faceEnrolledAt: "" } },
      { returnDocument: 'after' }
    );
    return result ? { ...result, _id: undefined } as any : null;
  }

  // Exams
  async getExams(): Promise<ExamRecord[]> {
    const col = await this.getExamsCollection();
    const docs = await col.find({}).toArray();
    return docs.map(d => ({ ...d, _id: undefined } as any));
  }

  async getExamById(id: string): Promise<ExamRecord | undefined> {
    const col = await this.getExamsCollection();
    const doc = await col.findOne({ id });
    return doc ? { ...doc, _id: undefined } as any : undefined;
  }

  async addExam(exam: ExamRecord): Promise<void> {
    const col = await this.getExamsCollection();
    await col.insertOne(exam as any);
  }

  async updateExam(id: string, updates: Partial<ExamRecord>): Promise<ExamRecord | null> {
    const col = await this.getExamsCollection();
    const result = await col.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result ? { ...result, _id: undefined } as any : null;
  }

  async getExamsForUser(userId: string, role: string): Promise<ExamRecord[]> {
    const col = await this.getExamsCollection();
    let query = {};
    if (role === 'center_head') query = { centerHeadId: userId };
    else if (role === 'invigilator') query = { invigilatorId: userId };
    else if (role !== 'admin') return [];

    const docs = await col.find(query).toArray();
    return docs.map(d => ({ ...d, _id: undefined } as any));
  }

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

    const windowOpen = diffMin <= 5 && diffMin >= -30;
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
  async addNotification(notification: NotificationRecord): Promise<void> {
    const col = await this.getNotificationsCollection();
    await col.insertOne(notification as any);
  }

  async getNotificationsForUser(userId: string): Promise<NotificationRecord[]> {
    const col = await this.getNotificationsCollection();
    const docs = await col.find({ userId }).sort({ createdAt: -1 }).toArray();
    return docs.map(d => ({ ...d, _id: undefined } as any));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const col = await this.getNotificationsCollection();
    return col.countDocuments({ userId, read: false });
  }

  async markNotificationRead(id: string, userId: string): Promise<boolean> {
    const col = await this.getNotificationsCollection();
    const res = await col.updateOne({ id, userId, read: false }, { $set: { read: true } });
    return res.modifiedCount > 0;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const col = await this.getNotificationsCollection();
    await col.updateMany({ userId, read: false }, { $set: { read: true } });
  }

  // Audit logs
  async addAuditLog(entry: AuditLogEntry): Promise<void> {
    const col = await this.getAuditLogsCollection();
    await col.insertOne(entry as any);
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const col = await this.getAuditLogsCollection();
    const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map(d => ({ ...d, _id: undefined } as any));
  }

  async getAuditLogsForExam(examId: string): Promise<AuditLogEntry[]> {
    const col = await this.getAuditLogsCollection();
    const docs = await col.find({ examId }).sort({ createdAt: -1 }).toArray();
    return docs.map(d => ({ ...d, _id: undefined } as any));
  }

  async pruneExpiredDemoExams(): Promise<number> {
    const col = await this.getExamsCollection();
    const allDemos = await col.find({ title: { $regex: '^\\[DEMO\\]' } }).toArray();
    const expiredIds = allDemos
      .filter(exam => this.computeExamStatus(exam as any).expired)
      .map(exam => exam.id);

    if (expiredIds.length > 0) {
      await col.deleteMany({ id: { $in: expiredIds } });
      const notifCol = await this.getNotificationsCollection();
      await notifCol.deleteMany({ examId: { $in: expiredIds } });
    }
    return expiredIds.length;
  }
}

// Singleton
const globalForStore = globalThis as unknown as { storeInstance: MongoStore | null };

export function getStore(): MongoStore {
  if (!globalForStore.storeInstance) {
    globalForStore.storeInstance = new MongoStore();
    // Non-blocking initialization
    globalForStore.storeInstance.init().catch(console.error);
  }
  return globalForStore.storeInstance;
}
