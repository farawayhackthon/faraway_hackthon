import { v4 as uuidv4 } from 'uuid';
import { getStore, type AuditLogEntry } from '@/lib/store';
import type { AuditEventType } from '@/lib/audit-types';

export function logAudit(input: {
  examId?: string;
  examTitle?: string;
  event: AuditEventType;
  actorId: string;
  actorName: string;
  actorRole: string;
  message: string;
  metadata?: Record<string, string | number | boolean>;
}): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: uuidv4(),
    examId: input.examId,
    examTitle: input.examTitle,
    event: input.event,
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    message: input.message,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
  getStore().addAuditLog(entry);
  return entry;
}
