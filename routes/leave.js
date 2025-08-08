const express = require("express");
const router = express.Router();
const requireRole = require('../middleware/roleAuth');

// Faculty requests leave
router.post("/request", requireRole('faculty'), async (req, res) => {
  try {
    const { reason, fromDate, toDate } = req.body;
    const supabase = req.app.get('supabase');
    const { data: leave, error } = await supabase.from('leave_requests').insert([
      {
        faculty_id: req.user.id,
        department: req.user.department,
        reason,
        from_date: fromDate,
        to_date: toDate,
        status: 'pending'
      }
    ]).select();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ leave: leave[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HOD/Admin views and manages leave requests
router.get("/all", requireRole('hod'), async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    let query = supabase.from('leave_requests').select('*');
    if (req.user.role === 'hod') {
      query = query.eq('department', req.user.department);
    }
    const { data: leaves, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ leaves });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HOD/Admin approves/rejects leave
router.post("/update-status", requireRole('hod'), async (req, res) => {
  try {
    const { leaveId, status } = req.body; // status: 'approved' or 'rejected'
    const supabase = req.app.get('supabase');
    const { data, error } = await supabase.from('leave_requests').update({ status }).eq('id', leaveId).select();
    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ leave: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
