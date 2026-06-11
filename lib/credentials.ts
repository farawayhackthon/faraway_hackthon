// Mock password hashes — pre-generated with bcrypt cost 12
// Admin@123     → $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oR5K1.Bca
// Center@123    → $2a$12$YYnr76blgqVHnEzKjuopQ.lX3VBW/H5K7Ul8HJbMNyV6bEjz6O4..
// Invigil@123   → $2a$12$dYt4f6WN8UoB3v2kHmP5S.h7z4T2ixiRG5BbYRQ8pBN9fBUNpLPOm
// NOTE: Since bcrypt compare is async, we use a pre-seeded approach. 
// The hashes below are bcryptjs-generated. 
// For dev convenience, we also do a plain-text fallback comparison.

export const MOCK_CREDENTIALS = {
  admin:        { password: 'Admin@123' },
  centerhead:   { password: 'Center@123' },
  invigilator:  { password: 'Invigil@123' },
} as const;
