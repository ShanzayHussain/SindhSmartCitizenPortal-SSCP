const { createClient } = require('@supabase/supabase-js');

function createAuthMiddleware({ query, syncUserToDB }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  function extractToken(req) {
    const hdr = String(req.headers.authorization || '');
    if (hdr.toLowerCase().startsWith('bearer ')) return hdr.slice(7).trim();
    return '';
  }

  async function verifySupabaseToken(req, res, next) {
    if (!supabase) {
      return res.status(500).json({
        error: 'Supabase server environment is not configured.',
        message: 'Supabase server environment is not configured.',
      });
    }

    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'No token', message: 'No token provided.' });

    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return res.status(401).json({ error: 'Invalid token', message: 'Invalid token.' });
      }

      req.supabaseUser = data.user;
      next();
    } catch (err) {
      console.error('Supabase Auth Error:', err.message);
      res.status(401).json({ error: 'Invalid token', message: 'Invalid token.' });
    }
  }

  async function requireAuth(req, res, next) {
    verifySupabaseToken(req, res, async () => {
      try {
        let dbUser = null;

        if (typeof syncUserToDB === 'function') {
          dbUser = await syncUserToDB(req.supabaseUser);
        } else if (query) {
          const result = await query(
            `SELECT USER_ID, FULL_NAME, EMAIL, ROLE
             FROM USERS
             WHERE SUPABASE_UID = :supabase_uid`,
            { supabase_uid: req.supabaseUser.id }
          );
          dbUser = result.rows?.[0] || null;
        }

        if (!dbUser) return res.status(401).json({ error: 'User not found', message: 'Unauthorized.' });

        req.user = dbUser;
        req.authUser = {
          user_id: dbUser.USER_ID,
          full_name: dbUser.FULL_NAME || '',
          email: dbUser.EMAIL || '',
          role: String(dbUser.ROLE || 'citizen').toLowerCase(),
        };
        next();
      } catch (err) {
        console.error('Auth Error:', err.message);
        res.status(500).json({ error: 'Authorization check failed', message: 'Authorization check failed.' });
      }
    });
  }

  return {
    supabase,
    extractToken,
    verifySupabaseToken,
    requireAuth,
  };
}

module.exports = { createAuthMiddleware };
