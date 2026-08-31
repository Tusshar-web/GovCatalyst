function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const userRole = (req.user.role || '').toLowerCase().replace(/[\s-]/g, '_');
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().replace(/[\s-]/g, '_'));
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires role: ${allowedRoles.join(' or ')}`,
      });
    }
    next();
  };
}

module.exports = { requireRole };