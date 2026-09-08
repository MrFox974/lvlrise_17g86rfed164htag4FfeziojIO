// server.js (dev local) - entrypoint pour le backend en local (Node)
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || process.env.SERVER_PORT || 8080;

(async () => {
  try {
    await app.dbReadyPromise;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Cannot start server:', err);
    process.exit(1);
  }
})();