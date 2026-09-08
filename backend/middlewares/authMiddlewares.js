const jwt = require('jsonwebtoken');

const authMiddlewares = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token!' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token expired or invalid!' });
    req.user_id = decoded.user_id;
    next();
  });
};

/** Authentification optionnelle : si token valide, remplit req.user_id ; sinon continue sans erreur. */
const authOptional = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    req.user_id = null;
    return next();
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    req.user_id = err ? null : decoded.user_id;
    next();
  });
};

module.exports = { authMiddlewares, authOptional };