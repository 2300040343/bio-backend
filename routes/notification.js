const express = require("express");
const router = express.Router();
const requireRole = require('../middleware/roleAuth');

// Admin/HOD sends notification
router.post("/send", requireRole('hod'), async (req, res) => {
  try {
    const { message, department } = req.body;
    const supabase = req.app.get('supabase');
    const { data: notification, error } = await supabase.from('notifications').insert([
      {
        message,
        department,
        sender_id: req.user.id,
        created_at: new Date().toISOString()
      }
    ]).select();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ notification: notification[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Faculty views notifications
router.get("/my", requireRole('faculty'), async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    const { data: notifications, error } = await supabase.from('notifications').select('*').eq('department', req.user.department);
    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
