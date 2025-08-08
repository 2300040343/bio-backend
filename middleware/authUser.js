// Dummy authentication middleware for demonstration
// In production, replace with JWT or Supabase Auth verification
module.exports = (req, res, next) => {
  // Example: set req.user from a header (for demo/testing)
  // In real use, decode JWT and set req.user
  req.user = {
    email: req.headers["x-user-email"] || "admin@example.com",
    role: req.headers["x-user-role"] || "admin",
    department: req.headers["x-user-department"] || "CSE"
  };
  next();
};
