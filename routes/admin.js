const express = require("express");
const router = express.Router();
const requireRole = require('../middleware/roleAuth');
const { Parser } = require('json2csv');

// List all users (admin: all, hod: only own department)
router.get("/users", requireRole('admin'), async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    let query = supabase.from('users').select('*');
    // If HOD, filter by department
    if (req.user.role === 'hod') {
      query = query.eq('department', req.user.department);
    }
    const { data: users, error } = await query;
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all attendance records (admin: all, hod: only own department)
router.get("/attendance", requireRole('admin'), async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    let query = supabase.from('attendance').select('*');
    // If HOD, filter by department
    if (req.user.role === 'hod') {
      // Get user IDs for this department
      const { data: users, error: userError } = await supabase.from('users').select('id').eq('department', req.user.department);
      if (userError) {
        return res.status(400).json({ error: userError.message });
      }
      const userIds = users.map(u => u.id);
      query = query.in('user_id', userIds);
    }
    const { data: attendance, error } = await query;
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(200).json({ attendance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export users as CSV (admin only)
router.get("/export/users", requireRole('admin'), async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    const parser = new Parser();
    const csv = parser.parse(users);
    res.header('Content-Type', 'text/csv');
    res.attachment('users.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
