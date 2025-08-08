// Role-based access middleware
module.exports = function requireRole(role) {
  return (req, res, next) => {
    // Assume req.user is set by authentication middleware
    if (req.user && req.user.role === role) {
      next();
    } else {
      res.status(403).json({ error: `Forbidden: ${role} role required` });
    }
  };
};
