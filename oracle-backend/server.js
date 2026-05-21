require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const axios   = require('axios');
const { createAuthMiddleware } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── DB POOL ──────────────────────────────────────────────────────
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit:    10,
});

// Helper — run query
async function query(sql, binds = []) {
  const [rows] = await pool.execute(sql, binds);
  return { rows };
}

// Test connection on startup
pool.getConnection()
  .then(c => { console.log('DB Connected!'); c.release(); })
  .catch(e => console.error('DB Failed:', e.message));

// ─── USER HELPERS ─────────────────────────────────────────────────
async function findUserBySupabaseIdentity(supabaseUser) {
  const supabaseUid = supabaseUser?.id;
  const email = String(supabaseUser?.email || '').toLowerCase();
  if (!supabaseUid || !email) return null;

  const result = await query(
    `SELECT user_id, full_name, email, cnic, phone, address,
            role, user_profilepic, father_name, district,
            DATE_FORMAT(dob, '%Y-%m-%d') AS dob, supabase_uid
     FROM users
     WHERE supabase_uid = ? OR LOWER(email) = ?
     LIMIT 1`,
    [supabaseUid, email]
  );
  return result.rows?.[0] || null;
}

async function syncUserToDB(supabaseUser, profile = {}) {
  const supabaseUid = supabaseUser?.id;
  const email = String(supabaseUser?.email || profile.Email || '').toLowerCase();
  if (!supabaseUid || !email) throw new Error('Supabase user is missing id or email.');

  const metadata  = supabaseUser.user_metadata || {};
  const fullName  = profile.Full_Name || metadata.full_name || metadata.name || email.split('@')[0];
  const cnic      = profile.CNIC     || metadata.cnic    || null;
  const phone     = profile.Phone    || metadata.phone   || null;
  const address   = profile.Address  || metadata.address || null;

  let user = await findUserBySupabaseIdentity(supabaseUser);

  if (user) {
    if (!user.supabase_uid) {
      await query(
        `UPDATE users SET supabase_uid = ? WHERE user_id = ?`,
        [supabaseUid, user.user_id]
      );
      user.supabase_uid = supabaseUid;
    }
    return user;
  }

  await query(
    `INSERT INTO users (supabase_uid, full_name, email, password, cnic, phone, address, role)
     VALUES (?, ?, ?, 'supabase-auth', ?, ?, ?, 'citizen')`,
    [supabaseUid, fullName, email, cnic, phone, address]
  );

  user = await findUserBySupabaseIdentity(supabaseUser);
  if (!user) throw new Error('User sync failed.');
  return user;
}

async function recordLogin(req, userId) {
  try {
    const ua     = String(req.headers['user-agent'] || '');
    const fwd    = req.headers['x-forwarded-for'];
    const ip     = String(typeof fwd === 'string' ? fwd.split(',')[0].trim() : req.socket?.remoteAddress || '');
    const device = /mobile/i.test(ua) ? 'Mobile' : /tablet|ipad/i.test(ua) ? 'Tablet' : 'Desktop';

    const isLocal = ['::1','127.0.0.1'].includes(ip) || ip.startsWith('192.168') || ip.startsWith('10.');
    let location  = 'Local Device';
    if (!isLocal) {
      const geo = await axios.get(`http://ip-api.com/json/${ip}?fields=city,country`, { timeout: 3000 }).catch(() => null);
      location = geo?.data?.city ? `${geo.data.city}, ${geo.data.country}` : ip || 'Unknown';
    }

    await query(
      `INSERT INTO login_logs (user_id, device, ip_address, status) VALUES (?, ?, ?, 'Success')`,
      [userId, device.substring(0,100), location.substring(0,50)]
    );
  } catch (logErr) {
    console.error('Log error:', logErr.message);
  }
}

async function buildUserResponse(u, token) {
  return {
    token,
    user_id:     u.user_id,
    full_name:   u.full_name    || '',
    email:       u.email        || '',
    cnic:        u.cnic         || '',
    phone:       u.phone        || '',
    address:     u.address      || '',
    role:        String(u.role  || 'citizen').toLowerCase(),
    profilepic:  u.user_profilepic || '',
    father_name: u.father_name  || '',
    district:    u.district     || '',
    dob:         u.dob          || '',
  };
}

const {
  supabase,
  extractToken,
  verifySupabaseToken,
  requireAuth: authRequired,
} = createAuthMiddleware({ query, syncUserToDB });

async function loadSyncedUser(req, profile = {}) {
  if (!req.supabaseUser) throw new Error('Supabase token is required.');
  return syncUserToDB(req.supabaseUser, profile);
}

function adminRequired(req, res, next) {
  if (req.authUser?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
}

function canAccessUser(req, targetUserId) {
  const authUserId      = Number(req.authUser?.user_id   || 0);
  const requestedUserId = Number(targetUserId || 0);
  if (!authUserId || !requestedUserId) return false;
  return req.authUser?.role === 'admin' || authUserId === requestedUserId;
}

async function getComplaintOwner(complaintId) {
  const result = await query(
    `SELECT complaint_id, user_id FROM complaints WHERE complaint_id = ?`,
    [Number(complaintId)]
  );
  return result.rows?.[0] || null;
}

// ─── REGISTER ────────────────────────────────────────────────────
app.post('/api/register', verifySupabaseToken, async (req, res) => {
  const { Full_Name, Email, CNIC, Phone, Address } = req.body || {};
  if (!Full_Name || !Email)
    return res.status(400).json({ message: 'Name and Email required.' });
  if (String(req.supabaseUser.email || '').toLowerCase() !== String(Email || '').toLowerCase())
    return res.status(403).json({ message: 'Supabase email does not match submitted email.' });

  try {
    const user = await loadSyncedUser(req, { Full_Name, Email, CNIC, Phone, Address });
    res.status(201).json({
      ...(await buildUserResponse(user, extractToken(req))),
      message: 'Registered successfully.',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ message: 'Email or CNIC already exists.' });
    console.error('Register Error:', err.message);
    res.status(500).json({ message: 'Registration failed.', details: err.message });
  }
});

// ─── LOGIN ───────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided.' });

  try {
    if (!supabase)
      return res.status(500).json({ message: 'Supabase server environment is not configured.' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ message: 'Invalid token.' });

    const user = await syncUserToDB(data.user);
    await recordLogin(req, user.user_id);
    res.json(await buildUserResponse(user, token));
  } catch (err) {
    console.error('Login Error:', err.message);
    res.status(500).json({ message: 'Login failed.', details: err.message });
  }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  res.json(req.authUser);
});

// ─── UPDATE PROFILE ──────────────────────────────────────────────
app.put('/api/users/:id', authRequired, async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Invalid user ID.' });
  if (!canAccessUser(req, userId)) return res.status(403).json({ message: 'Forbidden.' });

  const { full_name, phone, address, cnic, father_name, district, dob, profilepic } = req.body || {};

  try {
    const result = await query(
      `UPDATE users SET
         full_name       = ?,
         phone           = ?,
         address         = ?,
         cnic            = ?,
         father_name     = ?,
         district        = ?,
         dob             = ?,
         user_profilepic = ?
       WHERE user_id = ?`,
      [
        full_name    || null,
        phone        || null,
        address      || null,
        cnic         || null,
        father_name  || null,
        district     || null,
        dob          || null,
        profilepic   || null,
        userId,
      ]
    );
    if (!result.rows.affectedRows)
      return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Update Error:', err.message);
    res.status(500).json({ message: 'Update failed.', details: err.message });
  }
});

// ─── GET LOGIN LOGS ──────────────────────────────────────────────
app.get('/api/users/:id/logs', authRequired, async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Invalid user ID.' });
  if (!canAccessUser(req, userId)) return res.status(403).json({ message: 'Forbidden.' });

  try {
    const result = await query(
      `SELECT DATE_FORMAT(login_at, '%d %b %Y') AS date_str,
              device, ip_address, status
       FROM login_logs
       WHERE user_id = ?
       ORDER BY login_at DESC
       LIMIT 10`,
      [userId]
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error('Logs Error:', err.message);
    res.status(500).json({ message: 'Could not fetch logs.' });
  }
});

// ─── GET ALL USERS ───────────────────────────────────────────────
app.get('/api/users', authRequired, adminRequired, async (req, res) => {
  try {
    const result = await query(
      `SELECT user_id, full_name, email, cnic, phone, address,
              father_name, district, DATE_FORMAT(dob,'%Y-%m-%d') AS dob,
              role, created_at, user_profilepic
       FROM users ORDER BY user_id`
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error('Users Error:', err.message);
    res.status(500).json({ message: 'Could not fetch users.' });
  }
});

// ─── GET DATA (admin) ─────────────────────────────────────────────
app.get('/api/data', authRequired, adminRequired, async (req, res) => {
  try {
    const result = await query(
      `SELECT user_id, full_name, email, cnic, phone, address,
              father_name, district, DATE_FORMAT(dob,'%Y-%m-%d') AS dob,
              role, created_at, user_profilepic
       FROM users ORDER BY user_id`
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error('Data Error:', err.message);
    res.status(500).json({ message: 'Could not fetch data.' });
  }
});

// ─── DEPARTMENTS ──────────────────────────────────────────────────
app.get('/api/departments', async (req, res) => {
  try {
    const result = await query(`SELECT dept_id, dept_name FROM departments ORDER BY dept_id`);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Departments Error:', err.message);
    res.status(500).json({ message: 'Could not fetch departments.' });
  }
});

// ─── OFFICERS ─────────────────────────────────────────────────────
app.get('/api/officers', async (req, res) => {
  const deptId = req.query.dept_id;
  try {
    const sql    = deptId
      ? `SELECT officer_id, officer_name FROM officers WHERE dept_id = ? ORDER BY officer_id`
      : `SELECT officer_id, officer_name FROM officers ORDER BY officer_id`;
    const binds  = deptId ? [Number(deptId)] : [];
    const result = await query(sql, binds);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Officers Error:', err.message);
    res.status(500).json({ message: 'Could not fetch officers.' });
  }
});

// ─── SUBMIT COMPLAINT ─────────────────────────────────────────────
app.post('/api/complaints', authRequired, async (req, res) => {
  const { user_id, dept_id, title, description } = req.body || {};
  if (!user_id || !dept_id || !title)
    return res.status(400).json({ message: 'user_id, dept_id and title are required.' });
  if (Number(user_id) !== Number(req.authUser.user_id) && req.authUser?.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden.' });

  try {
    const result = await query(
      `INSERT INTO complaints (user_id, dept_id, title, description, status, date_filed)
       VALUES (?, ?, ?, ?, 'Pending', CURDATE())`,
      [Number(user_id), Number(dept_id), title.substring(0,200), description || null]
    );
    res.status(201).json({
      complaint_id: result.rows.insertId,
      message: 'Complaint submitted successfully.',
    });
  } catch (err) {
    console.error('Submit Complaint Error:', err.message);
    res.status(500).json({ message: 'Could not submit complaint.', details: err.message });
  }
});

// ─── GET COMPLAINTS FOR USER ──────────────────────────────────────
app.get('/api/complaints/user/:user_id', authRequired, async (req, res) => {
  const userId = Number(req.params.user_id);
  if (!userId) return res.status(400).json({ message: 'Invalid user ID.' });
  if (!canAccessUser(req, userId)) return res.status(403).json({ message: 'Forbidden.' });

  try {
    const result = await query(
      `SELECT
         c.complaint_id,
         LPAD(c.complaint_id, 5, '0') AS display_id,
         d.dept_name                  AS department,
         DATE_FORMAT(c.date_filed, '%d-%b-%Y') AS date_filed,
         c.status,
         COALESCE(o.officer_name, 'Not Assigned') AS officer,
         c.title
       FROM complaints c
       JOIN departments d  ON c.dept_id    = d.dept_id
       LEFT JOIN officers o ON c.officer_id = o.officer_id
       WHERE c.user_id = ?
       ORDER BY c.date_filed DESC`,
      [userId]
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error('Get Complaints Error:', err.message);
    res.status(500).json({ message: 'Could not fetch complaints.' });
  }
});

// ─── DASHBOARD FOR USER ───────────────────────────────────────────
app.get('/api/dashboard/:user_id', authRequired, async (req, res) => {
  const userId = Number(req.params.user_id);
  if (!userId) return res.status(400).json({ message: 'Invalid user ID.' });
  if (!canAccessUser(req, userId)) return res.status(403).json({ message: 'Forbidden.' });

  try {
    const statsResult = await query(
      `SELECT
         COUNT(*) AS total_complaints,
         SUM(status = 'Pending')     AS pending_complaints,
         SUM(status = 'In Progress') AS in_progress_complaints,
         SUM(status = 'Resolved')    AS resolved_complaints
       FROM complaints WHERE user_id = ?`,
      [userId]
    );

    const recentResult = await query(
      `SELECT c.complaint_id, c.title, d.dept_name AS department,
              c.status, DATE_FORMAT(c.date_filed, '%d-%b-%Y') AS date_filed
       FROM complaints c
       JOIN departments d ON c.dept_id = d.dept_id
       WHERE c.user_id = ?
       ORDER BY c.date_filed DESC LIMIT 5`,
      [userId]
    );

    const s = statsResult.rows?.[0] || {};
    res.json({
      stats: {
        total:      Number(s.total_complaints      || 0),
        pending:    Number(s.pending_complaints     || 0),
        inProgress: Number(s.in_progress_complaints || 0),
        resolved:   Number(s.resolved_complaints    || 0),
      },
      recentComplaints: (recentResult.rows || []).map(r => ({
  complaint_id: r.complaint_id,
  title:        r.title       || '',
  department:   r.department  || '',
  status:       r.status      || 'Pending',
  date_filed:   r.date_filed  || '',
})),
    });
  } catch (err) {
    console.error('Dashboard Error:', err.message);
    res.status(500).json({ message: 'Could not fetch dashboard data.', details: err.message });
  }
});

// ─── GET SINGLE COMPLAINT ─────────────────────────────────────────
app.get('/api/complaints/:id', authRequired, async (req, res) => {
  const complaintId = Number(req.params.id);
  if (!complaintId) return res.status(400).json({ message: 'Invalid complaint ID.' });

  try {
    const complaint = await getComplaintOwner(complaintId);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    if (!canAccessUser(req, complaint.user_id)) return res.status(403).json({ message: 'Forbidden.' });

    const result = await query(
      `SELECT c.complaint_id, c.title, c.status,
              d.dept_name AS department,
              COALESCE(o.officer_name,'Not Assigned') AS officer,
              DATE_FORMAT(c.date_filed,    '%d-%b-%Y') AS date_filed,
              DATE_FORMAT(c.date_resolved, '%d-%b-%Y') AS date_resolved,
              c.description
       FROM complaints c
       JOIN departments d  ON c.dept_id    = d.dept_id
       LEFT JOIN officers o ON c.officer_id = o.officer_id
       WHERE c.complaint_id = ?`,
      [complaintId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Complaint not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get Complaint Error:', err.message);
    res.status(500).json({ message: 'Could not fetch complaint.' });
  }
});

// ─── UPLOAD DOCUMENT ──────────────────────────────────────────────
app.post('/api/complaints/:id/documents', authRequired, async (req, res) => {
  const complaintId = Number(req.params.id);
  const { file_name, file_data } = req.body || {};
  if (!complaintId || !file_data)
    return res.status(400).json({ message: 'complaint_id and file_data required.' });

  try {
    const complaint = await getComplaintOwner(complaintId);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    if (!canAccessUser(req, complaint.user_id)) return res.status(403).json({ message: 'Forbidden.' });

    await query(
      `INSERT INTO complaint_documents (complaint_id, file_name, file_data) VALUES (?, ?, ?)`,
      [complaintId, file_name || 'document', file_data]
    );
    res.status(201).json({ message: 'Document uploaded.' });
  } catch (err) {
    console.error('Upload Doc Error:', err.message);
    res.status(500).json({ message: 'Could not upload document.', details: err.message });
  }
});

// ─── ADMIN: UPDATE COMPLAINT ──────────────────────────────────────
app.put('/api/complaints/:id', authRequired, adminRequired, async (req, res) => {
  const complaintId = Number(req.params.id);
  const { status, officer_id } = req.body || {};
  if (!complaintId) return res.status(400).json({ message: 'Invalid complaint ID.' });

  try {
    const result = await query(
      `UPDATE complaints SET
         status      = COALESCE(?, status),
         officer_id  = COALESCE(?, officer_id),
         date_resolved = CASE WHEN ? = 'Resolved' THEN CURDATE() ELSE date_resolved END
       WHERE complaint_id = ?`,
      [status || null, officer_id ? Number(officer_id) : null, status || null, complaintId]
    );
    if (!result.rows.affectedRows)
      return res.status(404).json({ message: 'Complaint not found.' });
    res.json({ message: 'Complaint updated.' });
  } catch (err) {
    console.error('Update Complaint Error:', err.message);
    res.status(500).json({ message: 'Could not update complaint.', details: err.message });
  }
});

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────
app.get('/api/admin/dashboard', authRequired, adminRequired, async (req, res) => {
  try {
    const statsResult = await query(
      `SELECT
         COUNT(*) AS total_complaints,
         SUM(status = 'Pending')     AS pending_complaints,
         SUM(status = 'In Progress') AS in_progress_complaints,
         SUM(status = 'Resolved')    AS resolved_complaints,
         SUM(status = 'Closed')      AS closed_complaints
       FROM complaints`
    );
    const recentResult = await query(
      `SELECT c.complaint_id, c.title, c.status,
              d.dept_name AS department, u.full_name AS citizen_name,
              DATE_FORMAT(c.date_filed, '%d-%b-%Y') AS date_filed
       FROM complaints c
       JOIN departments d ON d.dept_id = c.dept_id
       JOIN users u       ON u.user_id = c.user_id
       ORDER BY c.date_filed DESC LIMIT 10`
    );
    const r = statsResult.rows?.[0] || {};
    res.json({
      stats: {
        total:      Number(r.total_complaints      || 0),
        pending:    Number(r.pending_complaints     || 0),
        inProgress: Number(r.in_progress_complaints || 0),
        resolved:   Number(r.resolved_complaints    || 0),
        closed:     Number(r.closed_complaints      || 0),
      },
      recentComplaints: recentResult.rows || [],
    });
  } catch (err) {
    console.error('Admin Dashboard Error:', err.message);
    res.status(500).json({ message: 'Could not fetch admin dashboard.', details: err.message });
  }
});

// ─── ADMIN COMPLAINTS ─────────────────────────────────────────────
app.get('/api/admin/complaints', authRequired, adminRequired, async (req, res) => {
  const status = String(req.query.status || '').trim();
  const search = String(req.query.search || '').trim().toLowerCase();
  const deptId = Number(req.query.dept_id || 0);

  try {
    const whereParts = ['1=1'];
    const binds = [];
    if (status)  { whereParts.push('c.status = ?');                                   binds.push(status); }
    if (deptId)  { whereParts.push('c.dept_id = ?');                                  binds.push(deptId); }
    if (search)  { whereParts.push('(LOWER(c.title) LIKE ? OR LOWER(u.full_name) LIKE ?)'); binds.push(`%${search}%`, `%${search}%`); }

    const result = await query(
      `SELECT c.complaint_id, c.title, c.status,
              DATE_FORMAT(c.date_filed, '%d-%b-%Y') AS date_filed,
              d.dept_id, d.dept_name AS department,
              u.full_name AS citizen_name,
              o.officer_id,
              COALESCE(o.officer_name, 'Not Assigned') AS officer_name
       FROM complaints c
       JOIN departments d ON d.dept_id = c.dept_id
       JOIN users u       ON u.user_id = c.user_id
       LEFT JOIN officers o ON o.officer_id = c.officer_id
       WHERE ${whereParts.join(' AND ')}
       ORDER BY c.date_filed DESC`,
      binds
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error('Admin Complaints Error:', err.message);
    res.status(500).json({ message: 'Could not fetch complaints.', details: err.message });
  }
});

app.get('/api/admin/complaints/:id', authRequired, adminRequired, async (req, res) => {
  const complaintId = Number(req.params.id);
  if (!complaintId) return res.status(400).json({ message: 'Invalid complaint ID.' });

  try {
    const result = await query(
      `SELECT c.complaint_id, c.title, c.status, c.admin_remarks,
              c.dept_id, d.dept_name AS department,
              c.officer_id, COALESCE(o.officer_name,'Not Assigned') AS officer_name,
              u.user_id, u.full_name AS citizen_name, u.email AS citizen_email,
              u.cnic AS citizen_cnic, u.phone AS citizen_phone, u.address AS citizen_address,
              DATE_FORMAT(c.date_filed,    '%d-%b-%Y') AS date_filed,
              DATE_FORMAT(c.date_resolved, '%d-%b-%Y') AS date_resolved,
              c.description
       FROM complaints c
       JOIN departments d ON d.dept_id = c.dept_id
       JOIN users u       ON u.user_id = c.user_id
       LEFT JOIN officers o ON o.officer_id = c.officer_id
       WHERE c.complaint_id = ?`,
      [complaintId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Complaint not found.' });

    const docs = await query(
      `SELECT doc_id, file_name FROM complaint_documents
       WHERE complaint_id = ? ORDER BY doc_id DESC`,
      [complaintId]
    );
    res.json({ ...result.rows[0], documents: docs.rows || [] });
  } catch (err) {
    console.error('Admin Complaint Detail Error:', err.message);
    res.status(500).json({ message: 'Could not fetch complaint detail.', details: err.message });
  }
});

app.put('/api/admin/complaints/:id', authRequired, adminRequired, async (req, res) => {
  const complaintId  = Number(req.params.id);
  const { status, officer_id, admin_remarks } = req.body || {};
  if (!complaintId) return res.status(400).json({ message: 'Invalid complaint ID.' });

  const validStatuses = ['Pending', 'In Progress', 'Resolved', 'Closed'];
  const nextStatus    = status ? String(status).trim() : null;
  const nextOfficerId = (officer_id === '' || officer_id == null) ? null : Number(officer_id);

  if (!nextStatus) return res.status(400).json({ message: 'Status is required.' });
  if (!validStatuses.includes(nextStatus))
    return res.status(400).json({ message: `Invalid status. Use: ${validStatuses.join(', ')}.` });

  try {
    if (nextOfficerId) {
      const check = await query(
        `SELECT 1 FROM complaints c
         JOIN officers o ON o.officer_id = ?
         WHERE c.complaint_id = ? AND c.dept_id = o.dept_id`,
        [nextOfficerId, complaintId]
      );
      if (!check.rows.length)
        return res.status(400).json({ message: 'Officer must belong to complaint department.' });
    }

    const updateResult = await query(
      `UPDATE complaints SET
         status        = ?,
         officer_id    = ?,
         admin_remarks = COALESCE(?, admin_remarks),
         date_resolved = CASE WHEN ? = 'Resolved' THEN CURDATE() ELSE date_resolved END
       WHERE complaint_id = ?`,
      [nextStatus, nextOfficerId, admin_remarks || null, nextStatus, complaintId]
    );
    if (!updateResult.rows.affectedRows)
      return res.status(404).json({ message: 'Complaint not found.' });

    const refreshed = await query(
      `SELECT c.complaint_id, c.title, c.status, c.dept_id,
              d.dept_name AS department, c.officer_id,
              COALESCE(o.officer_name,'Not Assigned') AS officer_name,
              u.user_id, u.full_name AS citizen_name, u.email AS citizen_email,
              u.cnic AS citizen_cnic, u.phone AS citizen_phone, u.address AS citizen_address,
              DATE_FORMAT(c.date_filed,    '%d-%b-%Y') AS date_filed,
              DATE_FORMAT(c.date_resolved, '%d-%b-%Y') AS date_resolved,
              c.description
       FROM complaints c
       JOIN departments d ON d.dept_id = c.dept_id
       JOIN users u       ON u.user_id = c.user_id
       LEFT JOIN officers o ON o.officer_id = c.officer_id
       WHERE c.complaint_id = ?`,
      [complaintId]
    );
    res.json({ message: 'Complaint updated successfully.', complaint: refreshed.rows?.[0] || null });
  } catch (err) {
    console.error('Admin Complaint Update Error:', err.message);
    res.status(500).json({ message: 'Could not update complaint.', details: err.message });
  }
});

app.get('/api/admin/documents/:doc_id', authRequired, adminRequired, async (req, res) => {
  const docId = Number(req.params.doc_id);
  if (!docId) return res.status(400).json({ message: 'Invalid document ID.' });
  try {
    const result = await query(
      `SELECT file_name, file_data FROM complaint_documents WHERE doc_id = ?`,
      [docId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Document not found.' });
    res.json({ doc_id: docId, file_name: result.rows[0].file_name || 'document', file_data: result.rows[0].file_data || '' });
  } catch (err) {
    console.error('Admin Document Error:', err.message);
    res.status(500).json({ message: 'Could not fetch document.', details: err.message });
  }
});

// ─── ADMIN OFFICERS ───────────────────────────────────────────────
app.get('/api/admin/officers', authRequired, adminRequired, async (req, res) => {
  const deptId = Number(req.query.dept_id || 0);
  try {
    const sql = deptId
      ? `SELECT o.officer_id, o.officer_name, o.dept_id, d.dept_name
         FROM officers o JOIN departments d ON d.dept_id = o.dept_id
         WHERE o.dept_id = ? ORDER BY o.officer_id`
      : `SELECT o.officer_id, o.officer_name, o.dept_id, d.dept_name
         FROM officers o JOIN departments d ON d.dept_id = o.dept_id
         ORDER BY o.officer_id`;
    const result = await query(sql, deptId ? [deptId] : []);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Admin Officers Error:', err.message);
    res.status(500).json({ message: 'Could not fetch officers.', details: err.message });
  }
});

app.post('/api/admin/officers', authRequired, adminRequired, async (req, res) => {
  const { officer_name, dept_id } = req.body || {};
  if (!officer_name || !dept_id) return res.status(400).json({ message: 'officer_name and dept_id required.' });
  try {
    await query(
      `INSERT INTO officers (officer_name, dept_id) VALUES (?, ?)`,
      [String(officer_name).trim(), Number(dept_id)]
    );
    res.status(201).json({ message: 'Officer created.' });
  } catch (err) {
    console.error('Create Officer Error:', err.message);
    res.status(500).json({ message: 'Could not create officer.', details: err.message });
  }
});

app.put('/api/admin/officers/:id', authRequired, adminRequired, async (req, res) => {
  const officerId = Number(req.params.id);
  const { officer_name, dept_id } = req.body || {};
  if (!officerId) return res.status(400).json({ message: 'Invalid officer ID.' });
  try {
    const result = await query(
      `UPDATE officers SET
         officer_name = COALESCE(?, officer_name),
         dept_id      = COALESCE(?, dept_id)
       WHERE officer_id = ?`,
      [officer_name ? String(officer_name).trim() : null, dept_id ? Number(dept_id) : null, officerId]
    );
    if (!result.rows.affectedRows) return res.status(404).json({ message: 'Officer not found.' });
    res.json({ message: 'Officer updated.' });
  } catch (err) {
    console.error('Update Officer Error:', err.message);
    res.status(500).json({ message: 'Could not update officer.', details: err.message });
  }
});

// ─── ADMIN DEPARTMENTS ────────────────────────────────────────────
app.get('/api/admin/departments', authRequired, adminRequired, async (req, res) => {
  try {
    const result = await query(`SELECT dept_id, dept_name FROM departments ORDER BY dept_id`);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Admin Departments Error:', err.message);
    res.status(500).json({ message: 'Could not fetch departments.', details: err.message });
  }
});

app.post('/api/admin/departments', authRequired, adminRequired, async (req, res) => {
  const { dept_name } = req.body || {};
  if (!dept_name) return res.status(400).json({ message: 'dept_name required.' });
  try {
    await query(`INSERT INTO departments (dept_name) VALUES (?)`, [String(dept_name).trim()]);
    res.status(201).json({ message: 'Department created.' });
  } catch (err) {
    console.error('Create Department Error:', err.message);
    res.status(500).json({ message: 'Could not create department.', details: err.message });
  }
});

app.put('/api/admin/departments/:id', authRequired, adminRequired, async (req, res) => {
  const deptId    = Number(req.params.id);
  const { dept_name } = req.body || {};
  if (!deptId || !dept_name) return res.status(400).json({ message: 'dept_id and dept_name required.' });
  try {
    const result = await query(
      `UPDATE departments SET dept_name = ? WHERE dept_id = ?`,
      [String(dept_name).trim(), deptId]
    );
    if (!result.rows.affectedRows) return res.status(404).json({ message: 'Department not found.' });
    res.json({ message: 'Department updated.' });
  } catch (err) {
    console.error('Update Department Error:', err.message);
    res.status(500).json({ message: 'Could not update department.', details: err.message });
  }
});

// ─── START ────────────────────────────────────────────────────────
app.listen(5000, () => console.log('Server running on port 5000'));