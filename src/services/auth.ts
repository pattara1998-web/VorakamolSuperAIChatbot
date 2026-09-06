import crypto from 'crypto';

// ================================================================
// AUTHENTICATION & SESSION MANAGEMENT
// ================================================================

interface UserSession {
  session_id: string;
  user_id: string;
  username: string;
  role: 'superadmin' | 'admin' | 'user';
  ip_address: string;
  user_agent: string;
  location?: string;
  device_info?: string;
  login_at: string;
  last_activity: string;
  is_active: boolean;
}

interface BlockedUser {
  ip: string;
  reason: string;
  blocked_at: string;
  expires_at?: string;
}

interface LoginAttempt {
  ip: string;
  attempts: number;
  last_attempt: number;
  locked_until?: number;
}

// Admin credentials — SECURITY UPGRADE: only SHA-256 hashes are stored.
// Plaintext password/security code never appear in source code.
// Hash algorithm: sha256(value + 'superai_salt_2026') — see hashPassword().
// Can be overridden via env: ADMIN_USERNAME, ADMIN_PASSWORD_HASH, ADMIN_SECURITY_CODE_HASH
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'adminpremium';
const ADMIN_CREDENTIAL_HASHES = {
  password: process.env.ADMIN_PASSWORD_HASH || '88f83eb08e2d2209d3e54fb10d3a110d73d07b986e6ce0c6f4ddb86518ae248e',
  security_code: process.env.ADMIN_SECURITY_CODE_HASH || '1b5f87593aefdc350c4fc847c38f967507cdf149f0af282020ea3d52dcaee582'
};
const ADMIN_ROLE = 'superadmin' as const;

// In-memory session store (backed by SQLite)
const activeSessions = new Map<string, UserSession>();
const loginAttempts = new Map<string, LoginAttempt>();
const blockedIPs = new Map<string, BlockedUser>();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'superai_salt_2026').digest('hex');
}

// Constant-time comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function generateSessionId(): string {
  return `sess_${crypto.randomBytes(32).toString('hex')}`;
}

function generateToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function checkLoginAttempts(ip: string): { allowed: boolean; remaining: number; lockedUntil?: number } {
  const attempt = loginAttempts.get(ip);
  if (!attempt) return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };

  if (attempt.locked_until && Date.now() < attempt.locked_until) {
    return { allowed: false, remaining: 0, lockedUntil: attempt.locked_until };
  }

  if (Date.now() - attempt.last_attempt > LOCKOUT_DURATION_MS) {
    loginAttempts.delete(ip);
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
  }

  const remaining = MAX_LOGIN_ATTEMPTS - attempt.attempts;
  return { allowed: remaining > 0, remaining, lockedUntil: attempt.locked_until };
}

export function recordLoginAttempt(ip: string, success: boolean): void {
  if (success) {
    loginAttempts.delete(ip);
    return;
  }

  const attempt = loginAttempts.get(ip) || { ip, attempts: 0, last_attempt: 0 };
  attempt.attempts++;
  attempt.last_attempt = Date.now();

  if (attempt.attempts >= MAX_LOGIN_ATTEMPTS) {
    attempt.locked_until = Date.now() + LOCKOUT_DURATION_MS;
  }

  loginAttempts.set(ip, attempt);
}

export function authenticateUser(username: string, password: string, securityCode: string, ip: string, userAgent: string): { success: boolean; session?: UserSession; token?: string; error?: string } {
  // Check if IP is blocked
  const blocked = blockedIPs.get(ip);
  if (blocked && (!blocked.expires_at || Date.now() < new Date(blocked.expires_at).getTime())) {
    return { success: false, error: 'IP ถูกบล็อกชั่วคราว กรุณาลองใหม่ภายหลัง' };
  }

  // Check login attempts
  const { allowed, lockedUntil } = checkLoginAttempts(ip);
  if (!allowed) {
    const minutesLeft = Math.ceil(((lockedUntil || 0) - Date.now()) / 60000);
    return { success: false, error: `เข้าสู่ระบบเกินจำนวนครั้งที่กำหนด กรุณารอ ${minutesLeft} นาที` };
  }

  // Verify credentials (hash-based comparison, timing-safe)
  if (!safeCompare(username, ADMIN_USERNAME) || !safeCompare(hashPassword(password), ADMIN_CREDENTIAL_HASHES.password)) {
    recordLoginAttempt(ip, false);
    return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }

  if (!safeCompare(hashPassword(securityCode), ADMIN_CREDENTIAL_HASHES.security_code)) {
    recordLoginAttempt(ip, false);
    return { success: false, error: 'รหัสความปลอดภัยไม่ถูกต้อง' };
  }

  // Success - create session
  recordLoginAttempt(ip, true);
  const sessionId = generateSessionId();
  const token = generateToken();

  // Parse device info from user agent
  const deviceInfo = parseDeviceInfo(userAgent);

  const session: UserSession = {
    session_id: sessionId,
    user_id: ADMIN_USERNAME,
    username: ADMIN_USERNAME,
    role: ADMIN_ROLE,
    ip_address: ip,
    user_agent: userAgent,
    device_info: deviceInfo,
    login_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    is_active: true
  };

  activeSessions.set(sessionId, session);

  return { success: true, session, token };
}

export function validateSession(sessionId: string): UserSession | null {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  if (!session.is_active) return null;

  // Check timeout
  if (Date.now() - new Date(session.last_activity).getTime() > SESSION_TIMEOUT_MS) {
    session.is_active = false;
    return null;
  }

  // Update last activity
  session.last_activity = new Date().toISOString();
  return session;
}

export function endSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.is_active = false;
    activeSessions.delete(sessionId);
    return true;
  }
  return false;
}

export function getAllSessions(): UserSession[] {
  return Array.from(activeSessions.values()).filter(s => s.is_active);
}

export function kickSession(sessionId: string): boolean {
  return endSession(sessionId);
}

export function blockIP(ip: string, reason: string, durationHours?: number): void {
  blockedIPs.set(ip, {
    ip,
    reason,
    blocked_at: new Date().toISOString(),
    expires_at: durationHours ? new Date(Date.now() + durationHours * 3600000).toISOString() : undefined
  });
}

export function unblockIP(ip: string): boolean {
  return blockedIPs.delete(ip);
}

export function getBlockedIPs(): BlockedUser[] {
  return Array.from(blockedIPs.values());
}

export function getSessionCount(): number {
  return getAllSessions().length;
}

function parseDeviceInfo(userAgent: string): string {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Macintosh')) return 'Mac';
  if (userAgent.includes('Linux')) return 'Linux';
  return 'Unknown Device';
}

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    if (now - new Date(session.last_activity).getTime() > SESSION_TIMEOUT_MS) {
      session.is_active = false;
      activeSessions.delete(id);
    }
  }
  // Clean up expired blocks
  for (const [ip, block] of blockedIPs) {
    if (block.expires_at && now > new Date(block.expires_at).getTime()) {
      blockedIPs.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
