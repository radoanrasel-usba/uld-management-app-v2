import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { eq } from 'drizzle-orm';
import { db } from './src/db/index';
import { users } from './src/db/schema';
import { requireAuth, requireAdmin } from './src/middleware/auth';
import {
  getUlds,
  createUld,
  deleteUld,
  deleteUldsBatch,
  sendUlds,
  receiveUlds,
  changeUldStatus,
  getUldHistory,
  getUserLogs,
  clearUserLogs,
  insertUserLog,
  getBackups,
  createDatabaseBackup,
  restoreDatabaseBackup,
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUserByUid,
  seedUldsIfEmpty,
  exportDatabaseData,
  importDatabaseData
} from './src/db/helpers';

// In-memory security alerts queue (for real-time-like security notifications)
interface SecurityAlert {
  id: string;
  type: 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_PATTERN' | 'MULTIPLE_FAILURES';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  userEmail: string;
  ipAddress?: string;
  timestamp: Date;
}

const securityAlerts: SecurityAlert[] = [];

// Real-time SSE Clients pool
const sseClients: any[] = [];
const broadcastRealtimeUpdate = (type: string, data?: any) => {
  const payload = JSON.stringify({ type, data, timestamp: new Date() });
  sseClients.forEach((client) => {
    try {
      client.write(`event: update\ndata: ${payload}\n\n`);
    } catch (e) {
      // Ignore dead connections, they will be pruned on close
    }
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // SSE stream endpoint for real-time notifications
  app.get('/api/realtime/stream', requireAuth, (req: any, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(':ok\n\n');

    sseClients.push(res);

    const keepAliveInterval = setInterval(() => {
      try {
        res.write(':keepalive\n\n');
      } catch (err) {
        // Safe to ignore
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAliveInterval);
      const idx = sseClients.indexOf(res);
      if (idx !== -1) {
        sseClients.splice(idx, 1);
      }
    });
  });

  // Helper to add security alert and save to database
  const triggerSecurityAlert = async (
    type: SecurityAlert['type'],
    severity: SecurityAlert['severity'],
    message: string,
    userEmail: string,
    ipAddress?: string
  ) => {
    const alert: SecurityAlert = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      severity,
      message,
      userEmail,
      ipAddress,
      timestamp: new Date(),
    };
    securityAlerts.unshift(alert);

    // Persist in DB logs
    await insertUserLog(
      userEmail,
      'SECURITY_ALERT',
      'ALERT',
      `[${severity} ALERT] ${message}`,
      ipAddress
    );

    // Trim list
    if (securityAlerts.length > 50) {
      securityAlerts.pop();
    }

    // Broadcast alert real-time
    broadcastRealtimeUpdate('alerts_changed', alert);
  };

  // ---------------------------------------------------------------------------
  // AUTH REGISTER & LOGIN ENDPOINTS
  // ---------------------------------------------------------------------------

  app.post('/api/auth/register', async (req: any, res) => {
    try {
      const { email: inputEmail, password } = req.body;
      if (!inputEmail || !password) {
        return res.status(400).json({ error: 'USER MAIL and USER PASSWORD are required.' });
      }

      let email = inputEmail.trim().toLowerCase();
      if (!email.includes('@')) {
        email = `${email}@us-bangla.com`;
      }

      const isSpecialAdmin = email === 'codingmaster0088@gmail.com' || email === 'radoanrasel1122@gmail.com';
      const mockUid = `mock-${email.replace(/[^a-zA-Z0-9]/g, '-')}`;

      // Check if user exists
      const existing = await db.select().from(users).where(eq(users.email, email));

      if (existing.length > 0) {
        const existingUser = existing[0];
        if (isSpecialAdmin) {
          if (password === 'radoan.1122') {
            await db.update(users).set({ role: 'admin', status: 'approved', password }).where(eq(users.id, existingUser.id));
            const token = Buffer.from(email).toString('base64');
            return res.json({
              token,
              user: { uid: existingUser.uid, email: existingUser.email, role: 'admin', status: 'approved' },
              message: 'ADMIN_LOGIN_SUCCESS'
            });
          } else {
            return res.status(401).json({ error: 'Invalid admin password.' });
          }
        }
        return res.status(400).json({ error: 'Account already exists. Please log in.' });
      }

      // New registration
      const newRole = isSpecialAdmin ? 'admin' : 'visitor';
      const newStatus = isSpecialAdmin ? 'approved' : 'pending';

      const insertResult = await db.insert(users).values({
        uid: mockUid,
        email,
        password,
        role: newRole,
        status: newStatus,
      }).returning();

      const newUser = insertResult[0];
      broadcastRealtimeUpdate('users_changed');

      if (isSpecialAdmin) {
        const token = Buffer.from(email).toString('base64');
        return res.json({
          token,
          user: { uid: newUser.uid, email: newUser.email, role: 'admin', status: 'approved' },
          message: 'ADMIN_REGISTER_SUCCESS'
        });
      }

      return res.json({
        success: true,
        status: 'pending',
        message: 'PLEASE WAIT UNTIL RADOAN ACCEPT YOUR REQUEST',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (req: any, res) => {
    try {
      const { email: inputEmail, password } = req.body;
      if (!inputEmail || !password) {
        return res.status(400).json({ error: 'USER MAIL and USER PASSWORD are required.' });
      }

      let email = inputEmail.trim().toLowerCase();
      if (!email.includes('@')) {
        email = `${email}@us-bangla.com`;
      }

      const isSpecialAdmin = email === 'codingmaster0088@gmail.com' || email === 'radoanrasel1122@gmail.com';
      const mockUid = `mock-${email.replace(/[^a-zA-Z0-9]/g, '-')}`;

      // Handle special admin login
      if (isSpecialAdmin) {
        if (password === 'radoan.1122') {
          let adminUser;
          const existing = await db.select().from(users).where(eq(users.email, email));
          if (existing.length > 0) {
            adminUser = existing[0];
            if (adminUser.role !== 'admin' || adminUser.status !== 'approved') {
              const updated = await db.update(users).set({ role: 'admin', status: 'approved', password: 'radoan.1122' }).where(eq(users.id, adminUser.id)).returning();
              adminUser = updated[0];
            }
          } else {
            const ins = await db.insert(users).values({
              uid: mockUid,
              email,
              password: 'radoan.1122',
              role: 'admin',
              status: 'approved',
            }).returning();
            adminUser = ins[0];
          }

          const token = Buffer.from(email).toString('base64');
          await insertUserLog(email, 'LOGIN', 'SUCCESS', 'Admin authenticated with master password.');
          return res.json({
            token,
            user: { uid: adminUser.uid, email: adminUser.email, role: 'admin', status: 'approved' }
          });
        } else {
          await insertUserLog(email, 'LOGIN_ATTEMPT', 'FAILURE', 'Incorrect password for Admin account.');
          return res.status(401).json({ error: 'Invalid password for Admin account.' });
        }
      }

      // Check non-admin user
      const existing = await db.select().from(users).where(eq(users.email, email));
      if (existing.length === 0) {
        return res.status(404).json({ error: 'User account not found. Please click REGISTER to create your account.' });
      }

      const dbUser = existing[0];

      // Verify password if set
      if (dbUser.password && dbUser.password !== password) {
        await insertUserLog(email, 'LOGIN_ATTEMPT', 'FAILURE', 'Incorrect password provided.');
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }

      // Save password if missing
      if (!dbUser.password && password) {
        await db.update(users).set({ password }).where(eq(users.id, dbUser.id));
      }

      // Check clearance status
      if (dbUser.status === 'pending') {
        return res.status(403).json({
          status: 'pending',
          error: 'PLEASE WAIT UNTIL RADOAN ACCEPT YOUR REQUEST'
        });
      }

      if (dbUser.status === 'rejected') {
        return res.status(403).json({
          status: 'rejected',
          error: 'Your registration request has been rejected by Administrator Radoan.'
        });
      }

      const token = Buffer.from(email).toString('base64');
      await insertUserLog(email, 'LOGIN', 'SUCCESS', 'User authenticated successfully.');

      return res.json({
        token,
        user: {
          uid: dbUser.uid,
          email: dbUser.email,
          role: dbUser.role,
          status: dbUser.status
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------------
  // AUTH AND GENERAL AUDIT ROUTES
  // ---------------------------------------------------------------------------

  app.post('/api/audit/login-success', requireAuth, async (req: any, res) => {
    try {
      const email = req.user?.email || 'Unknown User';
      const ip = req.ip || req.headers['x-forwarded-for'] || '';
      await insertUserLog(email, 'LOGIN', 'SUCCESS', `User successfully authenticated and logged in.`, String(ip));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/auth/profile', requireAuth, async (req: any, res) => {
    try {
      res.json({
        id: req.user?.dbId,
        uid: req.user?.uid,
        email: req.user?.email,
        role: req.user?.dbRole,
        status: req.user?.dbStatus,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/audit/logout', requireAuth, async (req: any, res) => {
    try {
      const email = req.user?.email || 'Unknown User';
      const ip = req.ip || req.headers['x-forwarded-for'] || '';
      await insertUserLog(email, 'LOGOUT', 'SUCCESS', `User logged out cleanly.`, String(ip));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Access attempt logs (can trigger alerts if unauthorized)
  app.post('/api/audit/access-attempt', async (req: any, res) => {
    try {
      const { email, path, allowed, role } = req.body;
      const ip = req.ip || req.headers['x-forwarded-for'] || '';

      if (!allowed) {
        await insertUserLog(
          email || 'unauthenticated@guest.com',
          'ACCESS_ATTEMPT',
          'SUSPICIOUS',
          `Unauthorized access attempt to ${path} as role ${role || 'guest'}`,
          String(ip)
        );

        await triggerSecurityAlert(
          'UNAUTHORIZED_ACCESS',
          'HIGH',
          `Unauthorized access attempt to page '${path}' by user.`,
          email || 'unauthenticated@guest.com',
          String(ip)
        );
      } else {
        await insertUserLog(
          email,
          'ACCESS_ATTEMPT',
          'SUCCESS',
          `Authorized access to ${path}`,
          String(ip)
        );
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------------
  // ULD MANAGEMENT ROUTES (Authenticated)
  // ---------------------------------------------------------------------------

  app.get('/api/ulds', requireAuth, async (req: any, res) => {
    try {
      const uldsList = await getUlds();
      res.json(uldsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ulds', requireAuth, async (req: any, res) => {
    try {
      const { number, type, currentStation, status } = req.body;
      const email = req.user?.email || 'Unknown';
      if (!number || !type) {
        return res.status(400).json({ error: 'ULD number and type are required' });
      }
      const uld = await createUld(number.toUpperCase().trim(), type, currentStation || 'DAC', status || 'ACTIVE', email);
      broadcastRealtimeUpdate('ulds_changed');
      res.status(201).json(uld);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/ulds/:id', requireAuth, async (req: any, res) => {
    try {
      const uldId = parseInt(req.params.id, 10);
      const email = req.user?.email || 'Unknown';
      if (isNaN(uldId)) {
        return res.status(400).json({ error: 'Invalid ULD ID' });
      }
      const result = await deleteUld(uldId, email);
      broadcastRealtimeUpdate('ulds_changed');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ulds/batch-delete', requireAuth, async (req: any, res) => {
    try {
      const { ids } = req.body;
      const email = req.user?.email || 'Unknown';
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Array of ULD IDs is required for batch deletion' });
      }
      const result = await deleteUldsBatch(ids, email);
      broadcastRealtimeUpdate('ulds_changed');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ulds/send', requireAuth, async (req: any, res) => {
    try {
      const { ids, destination, origin, remarks } = req.body;
      const email = req.user?.email || 'Unknown';
      if (!ids || !Array.isArray(ids) || ids.length === 0 || !destination) {
        return res.status(400).json({ error: 'ULD IDs and destination are required' });
      }
      const result = await sendUlds(ids, destination, origin || 'DAC', email, remarks);
      broadcastRealtimeUpdate('ulds_changed');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ulds/receive', requireAuth, async (req: any, res) => {
    try {
      const { ids, origin } = req.body;
      const email = req.user?.email || 'Unknown';
      if (!ids || !Array.isArray(ids) || ids.length === 0 || !origin) {
        return res.status(400).json({ error: 'ULD IDs and origin station are required' });
      }
      const result = await receiveUlds(ids, origin, email);
      broadcastRealtimeUpdate('ulds_changed');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ulds/status', requireAuth, async (req: any, res) => {
    try {
      const { id, status } = req.body;
      const email = req.user?.email || 'Unknown';
      if (!id || !status) {
        return res.status(400).json({ error: 'ULD ID and status are required' });
      }
      const result = await changeUldStatus(id, status, email);
      broadcastRealtimeUpdate('ulds_changed');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/ulds/history/:number', requireAuth, async (req: any, res) => {
    try {
      const history = await getUldHistory(req.params.number);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------------
  // ADMIN CONTROL AND AUDITING ROUTES (Admin Only)
  // ---------------------------------------------------------------------------

  app.get('/api/admin/logs', requireAdmin, async (req: any, res) => {
    try {
      const logs = await getUserLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/logs', requireAdmin, async (req: any, res) => {
    try {
      const email = req.user?.email || 'Admin';
      const result = await clearUserLogs(email);
      broadcastRealtimeUpdate('logs_changed');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/users', requireAdmin, async (req: any, res) => {
    try {
      const usersList = await getUsers();
      res.json(usersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/users/role', requireAdmin, async (req: any, res) => {
    try {
      const { uid, role } = req.body;
      const email = req.user?.email || 'Admin';
      if (!uid || !role) {
        return res.status(400).json({ error: 'User uid and role are required' });
      }
      const updatedUser = await updateUserRole(uid, role);

      await insertUserLog(
        email,
        'ROLE_CHANGE',
        'SUCCESS',
        `Changed role of user ${updatedUser?.email || uid} to ${role}`
      );

      broadcastRealtimeUpdate('users_changed');
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/users/status', requireAdmin, async (req: any, res) => {
    try {
      const { uid, status } = req.body;
      const email = req.user?.email || 'Admin';
      if (!uid || !status) {
        return res.status(400).json({ error: 'User uid and status are required' });
      }
      const updatedUser = await updateUserStatus(uid, status);

      await insertUserLog(
        email,
        'STATUS_CHANGE',
        'SUCCESS',
        `Changed status of user ${updatedUser?.email || uid} to ${status}`
      );

      broadcastRealtimeUpdate('users_changed');
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/users/:uid', requireAdmin, async (req: any, res) => {
    try {
      const uid = req.params.uid;
      const email = req.user?.email || 'Admin';
      if (!uid) {
        return res.status(400).json({ error: 'User uid is required' });
      }
      const deletedUser = await deleteUserByUid(uid);

      await insertUserLog(
        email,
        'DELETE_USER',
        'SUCCESS',
        `Permanently removed user ${deletedUser?.email || uid}`
      );

      broadcastRealtimeUpdate('users_changed');
      res.json({ success: true, deletedUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/backups', requireAdmin, async (req: any, res) => {
    try {
      const backupsList = await getBackups();
      res.json(backupsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/backups', requireAdmin, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      const email = req.user?.email || 'Admin';
      if (!name) {
        return res.status(400).json({ error: 'Backup name is required' });
      }
      const backup = await createDatabaseBackup(name, description || '', email);
      res.status(201).json(backup);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/backups/restore/:id', requireAdmin, async (req: any, res) => {
    try {
      const backupId = parseInt(req.params.id, 10);
      const email = req.user?.email || 'Admin';
      if (isNaN(backupId)) {
        return res.status(400).json({ error: 'Invalid backup ID' });
      }
      const result = await restoreDatabaseBackup(backupId, email);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export raw database JSON data
  app.get('/api/admin/backup/export', requireAdmin, async (req: any, res) => {
    try {
      const email = req.user?.email || 'Admin';
      const data = await exportDatabaseData();
      await insertUserLog(email, 'DATABASE_EXPORT_JSON', 'SUCCESS', 'Downloaded full JSON database backup export file');
      broadcastRealtimeUpdate('logs_changed');
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Import raw database JSON data and restore
  app.post('/api/admin/backup/import', requireAdmin, async (req: any, res) => {
    try {
      const email = req.user?.email || 'Admin';
      const result = await importDatabaseData(req.body, email);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Fetch real-time security alerts
  app.get('/api/admin/alerts', requireAdmin, async (req: any, res) => {
    try {
      res.json(securityAlerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear a specific alert from dashboard
  app.post('/api/admin/alerts/clear', requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.body;
      const index = securityAlerts.findIndex(alert => alert.id === id);
      if (index !== -1) {
        securityAlerts.splice(index, 1);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------------------------
  // VITE DEV SERVER / STATIC ASSETS ROUTING
  // ---------------------------------------------------------------------------

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Auto-seed pre-determined AKE and PMC numbers if empty
  await seedUldsIfEmpty();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Aviation ULD Operations Server listening on http://localhost:${PORT}`);
  });
}

startServer();
