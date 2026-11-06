import 'dotenv/config';
import app from './app';

const DEFAULT_PORT = 3000;
const HOST = '0.0.0.0';

// Always listen on port 3000 as required by the runtime environment
const server = app.listen(DEFAULT_PORT, HOST, () => {
  console.log(`[DevLog] Server running on http://${HOST}:${DEFAULT_PORT}`);
});

// Also listen on process.env.PORT if specified and different from 3000
const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
if (envPort && envPort !== DEFAULT_PORT && !isNaN(envPort)) {
  try {
    app.listen(envPort, HOST, () => {
      console.log(`[DevLog] Server also listening on http://${HOST}:${envPort}`);
    });
  } catch (err) {
    console.warn(`[DevLog] Could not bind to secondary port ${envPort}:`, err);
  }
}

export default server;

