const express = require("express");
const router = express.Router();

// Register a device for a user
router.post("/register", async (req, res) => {
  try {
    const { rollNumber, mac, deviceId } = req.body;
    const supabase = req.app.get('supabase');

    // Find user by rollNumber
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('rollNumber', rollNumber)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: "User not found" });
    }

    // Register device
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .insert([
        { user_id: userData.id, mac, device_id: deviceId }
      ])
      .select();

    if (deviceError) {
      return res.status(400).json({ error: deviceError.message });
    }
    res.status(201).json({ device: deviceData[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
