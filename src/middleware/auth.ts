import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema';

export interface AuthRequest extends Request {
  user?: any; // Will contain decoded token and DB fields
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  try {
    // Decode token: can be plain text email or base64 email
    let email = token;
    if (!token.includes('@')) {
      try {
        email = Buffer.from(token, 'base64').toString('utf8');
      } catch (e) {
        email = token;
      }
    }

    if (!email.includes('@')) {
      email = `${email}@us-bangla.com`;
    }
    email = email.toLowerCase().trim();

    // Check or upsert user into SQL database safely without violating email unique constraints
    const isSpecialAdmin = email === 'codingmaster0088@gmail.com' || email === 'radoanrasel1122@gmail.com';
    const mockUid = `mock-${email.replace(/[^a-zA-Z0-9]/g, '-')}`;

    let dbUser;
    const existingByEmail = await db.select().from(users).where(eq(users.email, email));
    
    if (existingByEmail.length > 0) {
      dbUser = existingByEmail[0];
    } else {
      // Safe to insert new record
      const insertResult = await db.insert(users)
        .values({
          uid: mockUid,
          email,
          role: isSpecialAdmin ? 'admin' : 'visitor',
          status: isSpecialAdmin ? 'approved' : 'pending',
        })
        .returning();
      dbUser = insertResult[0];
    }

    // Auto-heal admin privileges for specified accounts
    if (isSpecialAdmin && (dbUser.role !== 'admin' || dbUser.status !== 'approved')) {
      const updateResult = await db.update(users)
        .set({ role: 'admin', status: 'approved' })
        .where(eq(users.id, dbUser.id))
        .returning();
      dbUser = updateResult[0];
    }

    // Attach user metadata to request
    req.user = {
      uid: dbUser.uid,
      email: dbUser.email,
      dbId: dbUser.id,
      dbRole: dbUser.role,
      dbStatus: dbUser.status,
    };

    // If account is not approved, only allow profile routing and logout
    const allowedPaths = ['/api/auth/profile', '/api/audit/logout'];
    if (dbUser.status !== 'approved' && !allowedPaths.includes(req.path)) {
      return res.status(403).json({ error: 'PENDING_APPROVAL', status: dbUser.status });
    }

    next();
  } catch (error) {
    console.error('Error in mock requireAuth:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  return requireAuth(req, res, () => {
    if (req.user && req.user.dbRole === 'admin') {
      next();
    } else {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  });
};
