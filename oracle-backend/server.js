require('dotenv').config();
const express = require('express');
const oracledb = require('oracledb');
const cors     = require('cors');
const axios    = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

oracledb.fetchAsString = [oracledb.CLOB];

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const db = {
  user:          process.env.DB_USER,
  password:      process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT,
};


oracledb.getConnection(db)
  .then(c => { console.log('DB Connected!'); c.close(); })
  .catch(e => console.error('DB Failed:', e.message));

// Helper — open connection, run query, close
async function query(sql, binds = {}, opts = {}) {
  const conn = await oracledb.getConnection(db);
  try {
    return await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, ...opts });
  } finally {
    await conn.close();
  }
}

function extractToken(req) {
  const hdr = String(req.headers.authorization || '');
  if (hdr.toLowerCase().startsWith('bearer ')) return hdr.slice(7).trim();
  return '';
}

async function verifySupabaseToken(req, res, next) {
  if (!supabase) {
    return res.status(500).json({ message: 'Supabase server environment is not configured.' });
  }

  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided.' });

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ message: 'Invalid token.' });

    req.supabaseUser = data.user;
    next();
  } catch (err) {
    console.error('Supabase Auth Error:', err.message);
    res.status(401).json({ message: 'Invalid token.' });
  }
}

async function findUserBySupabaseIdentity(supabaseUser) {
  const supabaseUid = supabaseUser?.id;
  const email = String(supabaseUser?.email || '').toLowerCase();
  if (!supabaseUid || !email) return null;

  const result = await query(
    `SELECT USER_ID, FULL_NAME, EMAIL, CNIC, PHONE, ADDRESS,
            ROLE, USER_PROFILEPIC, FATHER_NAME, DISTRICT,
            TO_CHAR(DOB, 'YYYY-MM-DD') AS DOB, SUPABASE_UID
     FROM USERS
     WHERE SUPABASE_UID = :supabase_uid OR LOWER(EMAIL) = :email
     FETCH FIRST 1 ROWS ONLY`,
    { supabase_uid: supabaseUid, email }
  );

  return result.rows?.[0] || null;
}

async function syncUserToDB(supabaseUser, profile = {}) {
  const supabaseUid = supabaseUser?.id;
  const email = String(supabaseUser?.email || profile.Email || '').toLowerCase();
  if (!supabaseUid || !email) throw new Error('Supabase user is missing id or email.');

  const metadata = supabaseUser.user_metadata || {};
  const fullName = profile.Full_Name || metadata.full_name || metadata.name || email.split('@')[0];
  const cnic = profile.CNIC || metadata.cnic || null;
  const phone = profile.Phone || metadata.phone || null;
  const address = profile.Address || metadata.address || null;

  let user = await findUserBySupabaseIdentity(supabaseUser);

  if (user) {
    if (!user.SUPABASE_UID) {
      await query(
        `UPDATE USERS
         SET SUPABASE_UID = :supabase_uid
         WHERE USER_ID = :user_id`,
        { supabase_uid: supabaseUid, user_id: user.USER_ID },
        { autoCommit: true }
      );
      user.SUPABASE_UID = supabaseUid;
    }
    return user;
  }

  const result = await query(
    `INSERT INTO USERS (SUPABASE_UID, FULL_NAME, EMAIL, PASSWORD, CNIC, PHONE, ADDRESS, ROLE)
     VALUES (:supabase_uid, :full_name, :email, 'supabase-auth', :cnic, :phone, :address, 'citizen')
     RETURNING USER_ID INTO :id`,
    {
      supabase_uid: supabaseUid,
      full_name: fullName,
      email,
      cnic,
      phone,
      address,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
    { autoCommit: true }
  );

  user = await findUserBySupabaseIdentity(supabaseUser);
  if (!user) throw new Error(`User sync failed for id ${result.outBinds.id?.[0] || 'unknown'}.`);
  return user;
}

async function recordLogin(req, userId) {
  try {
    const ua  = String(req.headers['user-agent'] || '');
    const fwd = req.headers['x-forwarded-for'];
    const ip  = String(typeof fwd === 'string' ? fwd.split(',')[0].trim() : req.socket?.remoteAddress || '');

    const device = /mobile/i.test(ua) ? 'Mobile' : /tablet|ipad/i.test(ua) ? 'Tablet' : 'Desktop';

    const isLocal = ['::1','127.0.0.1'].includes(ip) || ip.startsWith('192.168') || ip.startsWith('10.');
    let location  = 'Local Device';
    if (!isLocal) {
      const geo = await axios.get(`http://ip-api.com/json/${ip}?fields=city,country`, { timeout: 3000 }).catch(() => null);
      location = geo?.data?.city ? `${geo.data.city}, ${geo.data.country}` : ip || 'Unknown';
    }

    const conn2 = await oracledb.getConnection(db);
    await conn2.execute(
      `INSERT INTO LOGIN_LOGS (USER_ID, DEVICE, IP_ADDRESS, STATUS, LOGIN_AT)
       VALUES (:uid, :device, :loc, 'Success', SYSTIMESTAMP)`,
      { uid: userId, device: device.substring(0,100), loc: location.substring(0,50) },
      { autoCommit: true }
    );
    await conn2.close();
  } catch (logErr) {
    console.error('Log error:', logErr.message);
  }
}

async function buildUserResponse(u, token) {
  let pic = '';
  if (u.USER_PROFILEPIC) {
    pic = typeof u.USER_PROFILEPIC === 'string'
      ? u.USER_PROFILEPIC
      : (await u.USER_PROFILEPIC.getData?.() || '');
  }

  return {
    token,
    user_id:     u.USER_ID,
    full_name:   u.FULL_NAME   || '',
    email:       u.EMAIL       || '',
    cnic:        u.CNIC        || '',
    phone:       u.PHONE       || '',
    address:     u.ADDRESS     || '',
    role:        String(u.ROLE || 'citizen').toLowerCase(),
    profilepic:  pic,
    father_name: u.FATHER_NAME || '',
    district:    u.DISTRICT    || '',
    dob:         u.DOB         || '',
  };
}

async function authRequired(req, res, next) {
  verifySupabaseToken(req, res, async () => {
    try {
      const synced = await syncUserToDB(req.supabaseUser);
      const result = await query(
        `SELECT USER_ID, FULL_NAME, EMAIL, ROLE
         FROM USERS
         WHERE USER_ID = :user_id`,
        { user_id: synced.USER_ID }
      );
      if (!result.rows.length) return res.status(401).json({ message: 'Unauthorized.' });

      const u = result.rows[0];
      req.authUser = {
        user_id: u.USER_ID,
        full_name: u.FULL_NAME || '',
        email: u.EMAIL || '',
        role: String(u.ROLE || 'citizen').toLowerCase(),
      };
      next();
    } catch (err) {
      console.error('Auth Error:', err.message);
      res.status(500).json({ message: 'Authorization check failed.' });
    }
  });
}

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
  const authUserId = Number(req.authUser?.user_id || 0);
  const requestedUserId = Number(targetUserId || 0);
  if (!authUserId || !requestedUserId) return false;
  return req.authUser?.role === 'admin' || authUserId === requestedUserId;
}

async function getComplaintOwner(complaintId) {
  const result = await query(
    `SELECT COMPLAINT_ID, USER_ID
     FROM COMPLAINTS
     WHERE COMPLAINT_ID = :complaint_id`,
    { complaint_id: Number(complaintId) }
  );
  return result.rows?.[0] || null;
}

// ─── REGISTER ────────────────────────────────────────────────────
app.post('/api/register', verifySupabaseToken, async (req, res) => {
  const { Full_Name, Email, CNIC, Phone, Address } = req.body || {};

  if (!Full_Name || !Email)
    return res.status(400).json({ message: 'Name and Email required.' });

  if (String(req.supabaseUser.email || '').toLowerCase() !== String(Email || '').toLowerCase()) {
    return res.status(403).json({ message: 'Supabase email does not match submitted email.' });
  }

  try {
    const user = await loadSyncedUser(req, { Full_Name, Email, CNIC, Phone, Address });
    res.status(201).json({
      ...(await buildUserResponse(user, extractToken(req))),
      message: 'Registered successfully.',
    });
  } catch (err) {
    if (err.errorNum === 1)
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
    if (!supabase) {
      return res.status(500).json({ message: 'Supabase server environment is not configured.' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ message: 'Invalid token.' });

    const user = await syncUserToDB(data.user);
    await recordLogin(req, user.USER_ID);
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
      `UPDATE USERS SET
         FULL_NAME       = :full_name,
         PHONE           = :phone,
         ADDRESS         = :address,
         CNIC            = :cnic,
         FATHER_NAME     = :father_name,
         DISTRICT        = :district,
         DOB             = TO_DATE(NULLIF(:dob, ''), 'YYYY-MM-DD'),
         USER_PROFILEPIC = :profilepic
       WHERE USER_ID = :user_id`,
      {
        full_name:   full_name   || null,
        phone:       phone       || null,
        address:     address     || null,
        cnic:        cnic        || null,
        father_name: father_name || null,
        district:    district    || null,
        dob:         dob         || null,
        profilepic:  profilepic ? { val: profilepic, type: oracledb.CLOB } : null,
        user_id:     userId,
      },
      { autoCommit: true }
    );
    if (!result.rowsAffected) {
      return res.status(404).json({ message: 'User not found.' });
    }
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
      `SELECT TO_CHAR(LOGIN_AT, 'DD Mon YYYY') AS DATE_STR,
              DEVICE, IP_ADDRESS, STATUS
       FROM LOGIN_LOGS
       WHERE USER_ID = :user_id
       ORDER BY LOGIN_AT DESC
       FETCH FIRST 10 ROWS ONLY`,
      { user_id: userId }
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
      `SELECT USER_ID, FULL_NAME, EMAIL, CNIC, PHONE, ADDRESS,
              FATHER_NAME, DISTRICT, TO_CHAR(DOB,'YYYY-MM-DD') AS DOB,
              ROLE, CREATED_AT, USER_PROFILEPIC
       FROM USERS ORDER BY USER_ID`
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
      `SELECT USER_ID, FULL_NAME, EMAIL, CNIC, PHONE, ADDRESS,
              FATHER_NAME, DISTRICT, TO_CHAR(DOB,'YYYY-MM-DD') AS DOB,
              ROLE, CREATED_AT, USER_PROFILEPIC
       FROM USERS ORDER BY USER_ID`
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error('Data Error:', err.message);
    res.status(500).json({ message: 'Could not fetch data.' });
  }
});

// ─── START ───────────────────────────────────────────────────────
app.listen(5000, () => console.log('🚀 Server running on port 5000'));










// ─── GET ALL DEPARTMENTS ──────────────────────────────────────────
app.get('/api/departments', async (req, res) => {
  try {
    const result = await query(`SELECT DEPT_ID, DEPT_NAME FROM DEPARTMENTS ORDER BY DEPT_ID`);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Departments Error:', err.message);
    res.status(500).json({ message: 'Could not fetch departments.' });
  }
});


// ─── GET OFFICERS (optionally filter by dept) ─────────────────────
app.get('/api/officers', async (req, res) => {
  const deptId = req.query.dept_id;
  try {
    const sql = deptId
      ? `SELECT OFFICER_ID, OFFICER_NAME FROM OFFICERS WHERE DEPT_ID = :dept_id ORDER BY OFFICER_ID`
      : `SELECT OFFICER_ID, OFFICER_NAME FROM OFFICERS ORDER BY OFFICER_ID`;
    const binds = deptId ? { dept_id: Number(deptId) } : {};
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
  if (Number(user_id) !== Number(req.authUser.user_id) && req.authUser?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden.' });
  }

  try {
    const result = await query(
      `INSERT INTO COMPLAINTS (USER_ID, DEPT_ID, TITLE, DESCRIPTION, STATUS, DATE_FILED)
       VALUES (:user_id, :dept_id, :title, :description, 'Pending', SYSDATE)
       RETURNING COMPLAINT_ID INTO :id`,
      {
        user_id:     Number(user_id),
        dept_id:     Number(dept_id),
        title:       title.substring(0, 200),
        description: description
          ? { val: description, type: oracledb.CLOB }
          : null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    res.status(201).json({
      complaint_id: result.outBinds.id?.[0],
      message: 'Complaint submitted successfully.',
    });
  } catch (err) {
    console.error('Submit Complaint Error:', err.message);
    res.status(500).json({ message: 'Could not submit complaint.', details: err.message });
  }
});


// ─── GET COMPLAINTS FOR A USER ────────────────────────────────────
app.get('/api/complaints/user/:user_id', authRequired, async (req, res) => {
  const userId = Number(req.params.user_id);
  if (!userId) return res.status(400).json({ message: 'Invalid user ID.' });
  if (!canAccessUser(req, userId)) return res.status(403).json({ message: 'Forbidden.' });

  try {
    const result = await query(
      `SELECT
         C.COMPLAINT_ID,
         TO_CHAR(C.COMPLAINT_ID, 'FM00000') AS DISPLAY_ID,
         D.DEPT_NAME        AS DEPARTMENT,
         TO_CHAR(C.DATE_FILED, 'DD-Mon-YYYY') AS DATE_FILED,
         C.STATUS,
         NVL(O.OFFICER_NAME, 'Not Assigned') AS OFFICER,
         C.TITLE
       FROM COMPLAINTS C
       JOIN DEPARTMENTS D  ON C.DEPT_ID    = D.DEPT_ID
       LEFT JOIN OFFICERS O ON C.OFFICER_ID = O.OFFICER_ID
       WHERE C.USER_ID = :user_id
       ORDER BY C.DATE_FILED DESC`,
      { user_id: userId }
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error('Get Complaints Error:', err.message);
    res.status(500).json({ message: 'Could not fetch complaints.' });
  }
});


// ─── DASHBOARD DATA FOR A USER ────────────────────────────────────
app.get('/api/dashboard/:user_id', authRequired, async (req, res) => {
  const userId = Number(req.params.user_id);
  if (!userId) return res.status(400).json({ message: 'Invalid user ID.' });
  if (!canAccessUser(req, userId)) return res.status(403).json({ message: 'Forbidden.' });

  try {
    const statsResult = await query(
      `SELECT
         COUNT(*) AS TOTAL_COMPLAINTS,
         SUM(CASE WHEN STATUS = 'Pending' THEN 1 ELSE 0 END) AS PENDING_COMPLAINTS,
         SUM(CASE WHEN STATUS = 'In Progress' THEN 1 ELSE 0 END) AS IN_PROGRESS_COMPLAINTS,
         SUM(CASE WHEN STATUS = 'Resolved' THEN 1 ELSE 0 END) AS RESOLVED_COMPLAINTS
       FROM COMPLAINTS
       WHERE USER_ID = :user_id`,
      { user_id: userId }
    );

    const recentResult = await query(
      `SELECT
         C.COMPLAINT_ID,
         C.TITLE,
         D.DEPT_NAME AS DEPARTMENT,
         C.STATUS,
         TO_CHAR(C.DATE_FILED, 'DD-Mon-YYYY') AS DATE_FILED
       FROM COMPLAINTS C
       JOIN DEPARTMENTS D ON C.DEPT_ID = D.DEPT_ID
       WHERE C.USER_ID = :user_id
       ORDER BY C.DATE_FILED DESC
       FETCH FIRST 5 ROWS ONLY`,
      { user_id: userId }
    );

    const statsRow = statsResult.rows?.[0] || {};
    res.json({
      stats: {
        total: Number(statsRow.TOTAL_COMPLAINTS || 0),
        pending: Number(statsRow.PENDING_COMPLAINTS || 0),
        inProgress: Number(statsRow.IN_PROGRESS_COMPLAINTS || 0),
        resolved: Number(statsRow.RESOLVED_COMPLAINTS || 0),
      },
      recentComplaints: (recentResult.rows || []).map((row) => ({
        id: row.COMPLAINT_ID,
        title: row.TITLE || '',
        dept: row.DEPARTMENT || '',
        status: row.STATUS || 'Pending',
        date: row.DATE_FILED || '',
      })),
    });
  } catch (err) {
    console.error('Dashboard Error:', err.message);
    res.status(500).json({ message: 'Could not fetch dashboard data.', details: err.message });
  }
});


// ─── GET SINGLE COMPLAINT (for View Details) ──────────────────────
app.get('/api/complaints/:id', authRequired, async (req, res) => {
  const complaintId = Number(req.params.id);
  if (!complaintId) return res.status(400).json({ message: 'Invalid complaint ID.' });

  try {
    const complaint = await getComplaintOwner(complaintId);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    if (!canAccessUser(req, complaint.USER_ID)) return res.status(403).json({ message: 'Forbidden.' });

    const result = await query(
      `SELECT
         C.COMPLAINT_ID,
         C.TITLE,
         C.STATUS,
         D.DEPT_NAME                           AS DEPARTMENT,
         NVL(O.OFFICER_NAME, 'Not Assigned')   AS OFFICER,
         TO_CHAR(C.DATE_FILED,    'DD-Mon-YYYY') AS DATE_FILED,
         TO_CHAR(C.DATE_RESOLVED, 'DD-Mon-YYYY') AS DATE_RESOLVED,
         C.DESCRIPTION
       FROM COMPLAINTS C
       JOIN DEPARTMENTS D  ON C.DEPT_ID    = D.DEPT_ID
       LEFT JOIN OFFICERS O ON C.OFFICER_ID = O.OFFICER_ID
       WHERE C.COMPLAINT_ID = :complaint_id`,
      { complaint_id: complaintId }
    );

    if (!result.rows.length)
      return res.status(404).json({ message: 'Complaint not found.' });

    const row = result.rows[0];

    // CLOB → string for description
    let description = '';
    if (row.DESCRIPTION) {
      description = typeof row.DESCRIPTION === 'string'
        ? row.DESCRIPTION
        : (await row.DESCRIPTION.getData?.() || '');
    }

    res.json({ ...row, DESCRIPTION: description });
  } catch (err) {
    console.error('Get Complaint Error:', err.message);
    res.status(500).json({ message: 'Could not fetch complaint.' });
  }
});


// ─── UPLOAD DOCUMENT TO COMPLAINT ────────────────────────────────
app.post('/api/complaints/:id/documents', authRequired, async (req, res) => {
  const complaintId = Number(req.params.id);
  const { file_name, file_data } = req.body || {};

  if (!complaintId || !file_data)
    return res.status(400).json({ message: 'complaint_id and file_data required.' });

  try {
    const complaint = await getComplaintOwner(complaintId);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    if (!canAccessUser(req, complaint.USER_ID)) return res.status(403).json({ message: 'Forbidden.' });

    await query(
      `INSERT INTO COMPLAINT_DOCUMENTS (COMPLAINT_ID, FILE_NAME, FILE_DATA)
       VALUES (:complaint_id, :file_name, :file_data)`,
      {
        complaint_id: complaintId,
        file_name:    file_name || 'document',
        file_data:    { val: file_data, type: oracledb.CLOB },
      },
      { autoCommit: true }
    );
    res.status(201).json({ message: 'Document uploaded.' });
  } catch (err) {
    console.error('Upload Doc Error:', err.message);
    res.status(500).json({ message: 'Could not upload document.', details: err.message });
  }
});


// ─── ADMIN: UPDATE COMPLAINT STATUS / ASSIGN OFFICER ─────────────
app.put('/api/complaints/:id', authRequired, adminRequired, async (req, res) => {
  const complaintId = Number(req.params.id);
  const { status, officer_id } = req.body || {};

  if (!complaintId) return res.status(400).json({ message: 'Invalid complaint ID.' });

  try {
    const result = await query(
      `UPDATE COMPLAINTS SET
         STATUS      = NVL(:status, STATUS),
         OFFICER_ID  = NVL(:officer_id, OFFICER_ID),
         DATE_RESOLVED = CASE WHEN :status2 = 'Resolved' THEN SYSDATE ELSE DATE_RESOLVED END
       WHERE COMPLAINT_ID = :complaint_id`,
      {
        status:       status      || null,
        officer_id:   officer_id  ? Number(officer_id) : null,
        status2:      status      || null,
        complaint_id: complaintId,
      },
      { autoCommit: true }
    );
    if (!result.rowsAffected) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }
    res.json({ message: 'Complaint updated.' });
  } catch (err) {
    console.error('Update Complaint Error:', err.message);
    res.status(500).json({ message: 'Could not update complaint.', details: err.message });
  }
});

// ─── ADMIN DASHBOARD ───────────────────────────────────────────────
app.get('/api/admin/dashboard', authRequired, adminRequired, async (req, res) => {
  try {
    const statsResult = await query(
      `SELECT
         COUNT(*) AS TOTAL_COMPLAINTS,
         SUM(CASE WHEN STATUS = 'Pending' THEN 1 ELSE 0 END) AS PENDING_COMPLAINTS,
         SUM(CASE WHEN STATUS = 'In Progress' THEN 1 ELSE 0 END) AS IN_PROGRESS_COMPLAINTS,
         SUM(CASE WHEN STATUS = 'Resolved' THEN 1 ELSE 0 END) AS RESOLVED_COMPLAINTS,
         SUM(CASE WHEN STATUS = 'Closed' THEN 1 ELSE 0 END) AS CLOSED_COMPLAINTS
       FROM COMPLAINTS`
    );
    const recentResult = await query(
      `SELECT
         C.COMPLAINT_ID,
         C.TITLE,
         C.STATUS,
         D.DEPT_NAME AS DEPARTMENT,
         U.FULL_NAME AS CITIZEN_NAME,
         TO_CHAR(C.DATE_FILED, 'DD-Mon-YYYY') AS DATE_FILED
       FROM COMPLAINTS C
       JOIN DEPARTMENTS D ON D.DEPT_ID = C.DEPT_ID
       JOIN USERS U ON U.USER_ID = C.USER_ID
       ORDER BY C.DATE_FILED DESC
       FETCH FIRST 10 ROWS ONLY`
    );
    const row = statsResult.rows?.[0] || {};
    res.json({
      stats: {
        total: Number(row.TOTAL_COMPLAINTS || 0),
        pending: Number(row.PENDING_COMPLAINTS || 0),
        inProgress: Number(row.IN_PROGRESS_COMPLAINTS || 0),
        resolved: Number(row.RESOLVED_COMPLAINTS || 0),
        closed: Number(row.CLOSED_COMPLAINTS || 0),
      },
      recentComplaints: recentResult.rows || [],
    });
  } catch (err) {
    console.error('Admin Dashboard Error:', err.message);
    res.status(500).json({ message: 'Could not fetch admin dashboard.', details: err.message });
  }
});

// ─── ADMIN COMPLAINTS ──────────────────────────────────────────────
app.get('/api/admin/complaints', authRequired, adminRequired, async (req, res) => {
  const status = String(req.query.status || '').trim();
  const search = String(req.query.search || '').trim().toLowerCase();
  const deptId = Number(req.query.dept_id || 0);

  try {
    const whereParts = ['1=1'];
    const binds = {};
    if (status) {
      whereParts.push('C.STATUS = :status');
      binds.status = status;
    }
    if (deptId) {
      whereParts.push('C.DEPT_ID = :dept_id');
      binds.dept_id = deptId;
    }
    if (search) {
      whereParts.push('(LOWER(C.TITLE) LIKE :search OR LOWER(U.FULL_NAME) LIKE :search)');
      binds.search = `%${search}%`;
    }

    const result = await query(
      `SELECT
         C.COMPLAINT_ID,
         C.TITLE,
         C.STATUS,
         TO_CHAR(C.DATE_FILED, 'DD-Mon-YYYY') AS DATE_FILED,
         D.DEPT_ID,
         D.DEPT_NAME AS DEPARTMENT,
         U.FULL_NAME AS CITIZEN_NAME,
         O.OFFICER_ID,
         NVL(O.OFFICER_NAME, 'Not Assigned') AS OFFICER_NAME
       FROM COMPLAINTS C
       JOIN DEPARTMENTS D ON D.DEPT_ID = C.DEPT_ID
       JOIN USERS U ON U.USER_ID = C.USER_ID
       LEFT JOIN OFFICERS O ON O.OFFICER_ID = C.OFFICER_ID
       WHERE ${whereParts.join(' AND ')}
       ORDER BY C.DATE_FILED DESC`,
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
    let result;
    try {
      result = await query(
        `SELECT
           C.COMPLAINT_ID,
           C.TITLE,
           C.STATUS,
           C.ADMIN_REMARKS,
           C.DEPT_ID,
           D.DEPT_NAME AS DEPARTMENT,
           C.OFFICER_ID,
           NVL(O.OFFICER_NAME, 'Not Assigned') AS OFFICER_NAME,
           U.USER_ID,
           U.FULL_NAME AS CITIZEN_NAME,
           U.EMAIL AS CITIZEN_EMAIL,
           U.CNIC AS CITIZEN_CNIC,
           U.PHONE AS CITIZEN_PHONE,
           U.ADDRESS AS CITIZEN_ADDRESS,
           TO_CHAR(C.DATE_FILED, 'DD-Mon-YYYY') AS DATE_FILED,
           TO_CHAR(C.DATE_RESOLVED, 'DD-Mon-YYYY') AS DATE_RESOLVED,
           C.DESCRIPTION
         FROM COMPLAINTS C
         JOIN DEPARTMENTS D ON D.DEPT_ID = C.DEPT_ID
         JOIN USERS U ON U.USER_ID = C.USER_ID
         LEFT JOIN OFFICERS O ON O.OFFICER_ID = C.OFFICER_ID
         WHERE C.COMPLAINT_ID = :complaint_id`,
        { complaint_id: complaintId }
      );
    } catch (err) {
      if (err.errorNum !== 904) throw err; // ORA-00904 invalid identifier (ADMIN_REMARKS missing)
      result = await query(
        `SELECT
           C.COMPLAINT_ID,
           C.TITLE,
           C.STATUS,
           '' AS ADMIN_REMARKS,
           C.DEPT_ID,
           D.DEPT_NAME AS DEPARTMENT,
           C.OFFICER_ID,
           NVL(O.OFFICER_NAME, 'Not Assigned') AS OFFICER_NAME,
           U.USER_ID,
           U.FULL_NAME AS CITIZEN_NAME,
           U.EMAIL AS CITIZEN_EMAIL,
           U.CNIC AS CITIZEN_CNIC,
           U.PHONE AS CITIZEN_PHONE,
           U.ADDRESS AS CITIZEN_ADDRESS,
           TO_CHAR(C.DATE_FILED, 'DD-Mon-YYYY') AS DATE_FILED,
           TO_CHAR(C.DATE_RESOLVED, 'DD-Mon-YYYY') AS DATE_RESOLVED,
           C.DESCRIPTION
         FROM COMPLAINTS C
         JOIN DEPARTMENTS D ON D.DEPT_ID = C.DEPT_ID
         JOIN USERS U ON U.USER_ID = C.USER_ID
         LEFT JOIN OFFICERS O ON O.OFFICER_ID = C.OFFICER_ID
         WHERE C.COMPLAINT_ID = :complaint_id`,
        { complaint_id: complaintId }
      );
    }
    if (!result.rows.length) return res.status(404).json({ message: 'Complaint not found.' });
    const row = result.rows[0];
    let description = '';
    if (row.DESCRIPTION) {
      description = typeof row.DESCRIPTION === 'string'
        ? row.DESCRIPTION
        : (await row.DESCRIPTION.getData?.() || '');
    }
    let adminRemarks = '';
    if (row.ADMIN_REMARKS) {
      adminRemarks = typeof row.ADMIN_REMARKS === 'string'
        ? row.ADMIN_REMARKS
        : (await row.ADMIN_REMARKS.getData?.() || '');
    }

    const docs = await query(
      `SELECT DOC_ID, FILE_NAME
       FROM COMPLAINT_DOCUMENTS
       WHERE COMPLAINT_ID = :complaint_id
       ORDER BY DOC_ID DESC`,
      { complaint_id: complaintId }
    );
    res.json({
      ...row,
      DESCRIPTION: description,
      ADMIN_REMARKS: adminRemarks,
      documents: docs.rows || [],
    });
  } catch (err) {
    console.error('Admin Complaint Detail Error:', err.message);
    res.status(500).json({ message: 'Could not fetch complaint detail.', details: err.message });
  }
});

app.put('/api/admin/complaints/:id', authRequired, adminRequired, async (req, res) => {
  const complaintId = Number(req.params.id);
  const { status, officer_id, admin_remarks } = req.body || {};
  if (!complaintId) return res.status(400).json({ message: 'Invalid complaint ID.' });
  const validStatuses = ['Pending', 'In Progress', 'Resolved', 'Closed'];
  const nextStatus = status ? String(status).trim() : null;
  const nextOfficerId = officer_id === '' || officer_id === null || officer_id === undefined
    ? null
    : Number(officer_id);

  if (nextStatus && !validStatuses.includes(nextStatus)) {
    return res.status(400).json({ message: `Invalid status. Use one of: ${validStatuses.join(', ')}.` });
  }
  if (!nextStatus) {
    return res.status(400).json({ message: 'Status is required.' });
  }
  if (officer_id !== '' && officer_id !== null && officer_id !== undefined && !Number.isFinite(nextOfficerId)) {
    return res.status(400).json({ message: 'Invalid officer ID.' });
  }

  try {
    if (nextOfficerId) {
      const check = await query(
        `SELECT 1
         FROM COMPLAINTS C
         JOIN OFFICERS O ON O.OFFICER_ID = :officer_id
         WHERE C.COMPLAINT_ID = :complaint_id
           AND C.DEPT_ID = O.DEPT_ID`,
        { complaint_id: complaintId, officer_id: nextOfficerId }
      );
      if (!check.rows.length) {
        return res.status(400).json({ message: 'Officer must belong to complaint department.' });
      }
    }

    try {
      const updateResult = await query(
        `UPDATE COMPLAINTS SET
           STATUS = :status,
           OFFICER_ID = :officer_id,
           ADMIN_REMARKS = NVL(:admin_remarks, ADMIN_REMARKS),
           DATE_RESOLVED = CASE WHEN :status2 = 'Resolved' THEN SYSDATE ELSE DATE_RESOLVED END
         WHERE COMPLAINT_ID = :complaint_id`,
        {
          complaint_id: complaintId,
          status: nextStatus,
          status2: nextStatus,
          officer_id: nextOfficerId,
          admin_remarks: admin_remarks ? { val: admin_remarks, type: oracledb.CLOB } : null,
        },
        { autoCommit: true }
      );
      if (!updateResult.rowsAffected) {
        return res.status(404).json({ message: 'Complaint not found.' });
      }
    } catch (err) {
      if (err.errorNum === 904) {
        const fallbackResult = await query(
          `UPDATE COMPLAINTS SET
             STATUS = :status,
             OFFICER_ID = :officer_id,
             DATE_RESOLVED = CASE WHEN :status2 = 'Resolved' THEN SYSDATE ELSE DATE_RESOLVED END
           WHERE COMPLAINT_ID = :complaint_id`,
          {
            complaint_id: complaintId,
            status: nextStatus,
            status2: nextStatus,
            officer_id: nextOfficerId,
          },
          { autoCommit: true }
        );
        if (!fallbackResult.rowsAffected) {
          return res.status(404).json({ message: 'Complaint not found.' });
        }
      } else if (err.errorNum === 2290) {
        return res.status(400).json({
          message: 'Status is blocked by current DB constraint. Run schema migration for new status flow.',
          details: err.message,
        });
      } else {
        throw err;
      }
    }

    const refreshed = await query(
      `SELECT
         C.COMPLAINT_ID,
         C.TITLE,
         C.STATUS,
         C.DEPT_ID,
         D.DEPT_NAME AS DEPARTMENT,
         C.OFFICER_ID,
         NVL(O.OFFICER_NAME, 'Not Assigned') AS OFFICER_NAME,
         U.USER_ID,
         U.FULL_NAME AS CITIZEN_NAME,
         U.EMAIL AS CITIZEN_EMAIL,
         U.CNIC AS CITIZEN_CNIC,
         U.PHONE AS CITIZEN_PHONE,
         U.ADDRESS AS CITIZEN_ADDRESS,
         TO_CHAR(C.DATE_FILED, 'DD-Mon-YYYY') AS DATE_FILED,
         TO_CHAR(C.DATE_RESOLVED, 'DD-Mon-YYYY') AS DATE_RESOLVED,
         C.DESCRIPTION
       FROM COMPLAINTS C
       JOIN DEPARTMENTS D ON D.DEPT_ID = C.DEPT_ID
       JOIN USERS U ON U.USER_ID = C.USER_ID
       LEFT JOIN OFFICERS O ON O.OFFICER_ID = C.OFFICER_ID
       WHERE C.COMPLAINT_ID = :complaint_id`,
      { complaint_id: complaintId }
    );

    const updated = refreshed.rows?.[0] || null;
    if (updated?.DESCRIPTION && typeof updated.DESCRIPTION !== 'string') {
      updated.DESCRIPTION = await updated.DESCRIPTION.getData?.() || '';
    }
    res.json({ message: 'Complaint updated successfully.', complaint: updated });
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
      `SELECT FILE_NAME, FILE_DATA
       FROM COMPLAINT_DOCUMENTS
       WHERE DOC_ID = :doc_id`,
      { doc_id: docId }
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Document not found.' });
    const row = result.rows[0];
    let fileData = '';
    if (row.FILE_DATA) {
      fileData = typeof row.FILE_DATA === 'string'
        ? row.FILE_DATA
        : (await row.FILE_DATA.getData?.() || '');
    }
    res.json({ doc_id: docId, file_name: row.FILE_NAME || 'document', file_data: fileData });
  } catch (err) {
    console.error('Admin Document Error:', err.message);
    res.status(500).json({ message: 'Could not fetch document.', details: err.message });
  }
});

// ─── ADMIN OFFICERS ────────────────────────────────────────────────
app.get('/api/admin/officers', authRequired, adminRequired, async (req, res) => {
  const deptId = Number(req.query.dept_id || 0);
  try {
    const sql = deptId
      ? `SELECT O.OFFICER_ID, O.OFFICER_NAME, O.DEPT_ID, D.DEPT_NAME
         FROM OFFICERS O
         JOIN DEPARTMENTS D ON D.DEPT_ID = O.DEPT_ID
         WHERE O.DEPT_ID = :dept_id
         ORDER BY O.OFFICER_ID`
      : `SELECT O.OFFICER_ID, O.OFFICER_NAME, O.DEPT_ID, D.DEPT_NAME
         FROM OFFICERS O
         JOIN DEPARTMENTS D ON D.DEPT_ID = O.DEPT_ID
         ORDER BY O.OFFICER_ID`;
    const result = await query(sql, deptId ? { dept_id: deptId } : {});
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
      `INSERT INTO OFFICERS (OFFICER_NAME, DEPT_ID)
       VALUES (:officer_name, :dept_id)`,
      { officer_name: String(officer_name).trim(), dept_id: Number(dept_id) },
      { autoCommit: true }
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
      `UPDATE OFFICERS SET
         OFFICER_NAME = NVL(:officer_name, OFFICER_NAME),
         DEPT_ID = NVL(:dept_id, DEPT_ID)
       WHERE OFFICER_ID = :officer_id`,
      {
        officer_id: officerId,
        officer_name: officer_name ? String(officer_name).trim() : null,
        dept_id: dept_id ? Number(dept_id) : null,
      },
      { autoCommit: true }
    );
    if (!result.rowsAffected) {
      return res.status(404).json({ message: 'Officer not found.' });
    }
    res.json({ message: 'Officer updated.' });
  } catch (err) {
    console.error('Update Officer Error:', err.message);
    res.status(500).json({ message: 'Could not update officer.', details: err.message });
  }
});

// ─── ADMIN DEPARTMENTS ─────────────────────────────────────────────
app.get('/api/admin/departments', authRequired, adminRequired, async (req, res) => {
  try {
    const result = await query(`SELECT DEPT_ID, DEPT_NAME FROM DEPARTMENTS ORDER BY DEPT_ID`);
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
    await query(
      `INSERT INTO DEPARTMENTS (DEPT_NAME)
       VALUES (:dept_name)`,
      { dept_name: String(dept_name).trim() },
      { autoCommit: true }
    );
    res.status(201).json({ message: 'Department created.' });
  } catch (err) {
    console.error('Create Department Error:', err.message);
    res.status(500).json({ message: 'Could not create department.', details: err.message });
  }
});

app.put('/api/admin/departments/:id', authRequired, adminRequired, async (req, res) => {
  const deptId = Number(req.params.id);
  const { dept_name } = req.body || {};
  if (!deptId || !dept_name) return res.status(400).json({ message: 'dept_id and dept_name required.' });
  try {
    const result = await query(
      `UPDATE DEPARTMENTS
       SET DEPT_NAME = :dept_name
       WHERE DEPT_ID = :dept_id`,
      { dept_name: String(dept_name).trim(), dept_id: deptId },
      { autoCommit: true }
    );
    if (!result.rowsAffected) {
      return res.status(404).json({ message: 'Department not found.' });
    }
    res.json({ message: 'Department updated.' });
  } catch (err) {
    console.error('Update Department Error:', err.message);
    res.status(500).json({ message: 'Could not update department.', details: err.message });
  }
});
