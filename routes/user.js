const express = require("express");
const router = express.Router();
const axios = require('axios');

// Get attendance logs for a user by rollNumber
router.get("/attendance/:rollNumber", async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const supabase = req.app.get('supabase');

    // Find user by rollNumber
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, rollNumber')
      .eq('rollNumber', rollNumber)
      .single();
    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get attendance logs
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .order('marked_at', { ascending: false });
    if (attendanceError) {
      return res.status(400).json({ error: attendanceError.message });
    }
    res.status(200).json({ user, attendance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance marking with all security checks
router.post("/attendance/mark", async (req, res) => {
  try {
    const { rollNumber, faceData, fingerprintData, ssid, mac, latitude, longitude } = req.body;
    const supabase = req.app.get('supabase');

    // 1. Find user by rollNumber
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('rollNumber', rollNumber)
      .single();
    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2. Biometric check (simple string match for demo)
    if (faceData && user.faceData && faceData !== user.faceData) {
      return res.status(401).json({ error: "Face data does not match" });
    }
    if (fingerprintData && user.fingerprintData && fingerprintData !== user.fingerprintData) {
      return res.status(401).json({ error: "Fingerprint data does not match" });
    }

    // 3. SSID check
    if (ssid !== process.env.ALLOWED_SSID) {
      return res.status(401).json({ error: "SSID not allowed" });
    }

    // 4. MAC address check
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('mac', mac)
      .single();
    if (deviceError || !device) {
      return res.status(401).json({ error: "Device not registered" });
    }

    // 5. Geo-fence check
    const allowedLat = parseFloat(process.env.GEO_LAT);
    const allowedLng = parseFloat(process.env.GEO_LNG);
    const allowedRadius = parseFloat(process.env.GEO_RADIUS_METERS);
    function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
      const R = 6371000; // Radius of the earth in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        0.5 - Math.cos(dLat)/2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        (1 - Math.cos(dLon))/2;
      return R * 2 * Math.asin(Math.sqrt(a));
    }
    const distance = getDistanceFromLatLonInMeters(allowedLat, allowedLng, latitude, longitude);
    if (distance > allowedRadius) {
      return res.status(401).json({ error: "Outside allowed location" });
    }

    // 6. Log attendance
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .insert([
        {
          user_id: user.id,
          marked_at: new Date().toISOString(),
          latitude,
          longitude,
          ssid,
          mac
        }
      ])
      .select();
    if (attendanceError) {
      return res.status(400).json({ error: attendanceError.message });
    }
    res.status(201).json({ message: "Attendance marked", attendance: attendanceData[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login with biometric, SSID, MAC, and geo-fence checks
// Login with email and password only (Supabase Auth)
router.post("/login", async (req, res) => {
  try {
    console.log("/login request body:", req.body);
    const { email, password } = req.body;
    const supabase = req.app.get('supabase');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      return res.status(401).json({ error: error.message });
    }
    res.status(200).json({ message: "Login successful", user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Register user with Supabase Auth and insert profile data
const bcrypt = require('bcrypt');
const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'];
const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const SSID_ALLOWED = 'CollegeWiFi';

// Register user with Supabase Auth and insert profile data (with validation, hashing, biometrics, ssid, macAddress)
router.post("/register", async (req, res) => {
  console.log('Register request body:', req.body);
  try {
    const {
      name,
      email,
      rollNumber,
      password,
      department,
      faceData,
      fingerprintData,
      ssid,
      macAddress,
      latitude,
      longitude
    } = req.body;
    const supabase = req.app.get('supabase');

    // Validate required fields
    if (!name || !email || !password || !department || !rollNumber ||
        !faceData || !fingerprintData || !ssid || !macAddress) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields.' });
    }
    // Validate email
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return res.status(400).json({ status: 'error', message: 'Invalid email format.' });
    }
    // Validate department
    if (!DEPARTMENTS.includes(department)) {
      return res.status(400).json({ status: 'error', message: 'Invalid department.' });
    }
    // Validate ssid
    if (ssid !== SSID_ALLOWED) {
      return res.status(400).json({ status: 'error', message: 'SSID must be CollegeWiFi.' });
    }
    // Validate MAC address
    if (!MAC_REGEX.test(macAddress)) {
      return res.status(400).json({ status: 'error', message: 'Invalid MAC address format.' });
    }
    // Validate biometric data (no strict format enforced for faceData)
    if (!/^([A-Za-z0-9+/=]+)$/.test(fingerprintData)) {
      return res.status(400).json({ status: 'error', message: 'fingerprintData must be base64.' });
    }
    // Validate latitude/longitude if presen
    if (latitude && isNaN(parseFloat(latitude))) {
      return res.status(400).json({ status: 'error', message: 'Invalid latitude.' });
    }
    if (longitude && isNaN(parseFloat(longitude))) {
      return res.status(400).json({ status: 'error', message: 'Invalid longitude.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Register with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });
    if (authError) {
      return res.status(400).json({ status: "error", message: authError.message });
    }

    // Insert user profile into users table (store biometrics, ssid, macAddress)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          name,
          email,
          rollNumber,
          auth_id: authData.user ? authData.user.id : null,
          department,
          faceData,
          fingerprintData,
          ssid,
          macAddress,
          latitude,
          longitude,
          password: hashedPassword
        }
      ])
      .select();

    if (userError) {
      return res.status(400).json({ status: "error", message: userError.message });
    }

    // Exclude sensitive fields from response
    const userResponse = { ...userData[0] };
    delete userResponse.faceData;
    delete userResponse.fingerprintData;
    delete userResponse.password;

    res.status(201).json({
      status: "success",
      user: userResponse
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Update user profile
router.patch("/profile", async (req, res) => {
  try {
    const { rollNumber, name, email } = req.body;
    const supabase = req.app.get('supabase');
    const { data: user, error: userError } = await supabase
      .from('users')
      .update({ name, email })
      .eq('rollNumber', rollNumber)
      .select();
    if (userError || !user || user.length === 0) {
      return res.status(400).json({ error: userError ? userError.message : 'User not found' });
    }
    res.status(200).json({ message: 'Profile updated', user: user[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password
router.post("/change-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const supabase = req.app.get('supabase');
    // Find user by email to get auth_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('auth_id')
      .eq('email', email)
      .single();
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Use Supabase Admin API to update password
    const url = `${process.env.SUPABASE_URL}/auth/v1/admin/users/${user.auth_id}`;
    const response = await axios.put(url, { password: newPassword }, {
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.data && response.data.id) {
      res.status(200).json({ message: 'Password updated' });
    } else {
      res.status(400).json({ error: 'Failed to update password' });
    }
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.msg || err.message });
  }
});

// View registered devices
router.get("/devices/:rollNumber", async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const supabase = req.app.get('supabase');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('rollNumber', rollNumber)
      .single();
    if (userError || !user) {
      return res.status(404).json({ error: userError ? userError.message : 'User not found' });
    }
    const { data: devices, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id);
    if (deviceError) {
      return res.status(400).json({ error: deviceError.message });
    }
    res.status(200).json({ devices });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Attendance statistics (monthly/weekly)
router.get("/attendance/:rollNumber/stats", async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const supabase = req.app.get('supabase');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, rollNumber')
      .eq('rollNumber', rollNumber)
      .single();
    if (userError || !user) {
      return res.status(404).json({ error: userError ? userError.message : `User not found for rollNumber: ${rollNumber}` });
    }
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('marked_at')
      .eq('user_id', user.id);
    if (attendanceError) {
      return res.status(400).json({ error: attendanceError.message });
    }
    // Calculate stats
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    let monthly = 0, weekly = 0;
    attendance.forEach(a => {
      const date = new Date(a.marked_at);
      if (date.getMonth() === month && date.getFullYear() === year) monthly++;
      if (date >= weekStart && date <= weekEnd) weekly++;
    });
    res.status(200).json({ monthly, weekly, user: user.rollNumber });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Delete user account
router.delete("/delete", async (req, res) => {
  try {
    const { email, rollNumber } = req.body;
    const supabase = req.app.get('supabase');
    // Find all users by email and rollNumber
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('auth_id, email, rollNumber')
      .eq('email', email)
      .eq('rollNumber', rollNumber);
    if (userError || !users || users.length === 0) {
      return res.status(404).json({ error: userError ? userError.message : `No users found for email: ${email}, rollNumber: ${rollNumber}` });
    }
    // Delete each user from Supabase Auth and users table
    for (const user of users) {
      if (user.auth_id) {
        const url = `${process.env.SUPABASE_URL}/auth/v1/admin/users/${user.auth_id}`;
        await axios.delete(url, {
          headers: {
            'apikey': process.env.SUPABASE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    await supabase.from('users').delete().eq('rollNumber', rollNumber).eq('email', email);
    res.status(200).json({ message: 'Account(s) deleted', users });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.msg || err.message });
  }
});

// TEMP: List all users for debugging
router.get("/debug/all-users", async (req, res) => {
  try {
    const supabase = req.app.get('supabase');
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
