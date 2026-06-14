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

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  exam_uploaded: 'Exam Uploaded',
  signature_center_head: 'Center Head Signed',
  signature_invigilator: 'Invigilator Signed',
  face_enrolled: 'Face Enrolled',
  face_verified: 'Face Verified',
  face_verification_failed: 'Face Verification Failed',
  exam_decrypted: 'Exam Decrypted',
  exam_viewed: 'Paper Viewed',
  exam_printed: 'Paper Printed/Downloaded',
};
