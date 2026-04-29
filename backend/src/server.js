import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import packageInfo from '../package.json' with { type: 'json' };
import { config } from './config.js';
import authRoutes from './routes/authRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import toolRoutes from './routes/toolRoutes.js';
import userRoutes from './routes/userRoutes.js';
import seoLandingRoutes from './routes/seoLandingRoutes.js';
import { recoverInterruptedTasks } from './services/taskService.js';
import { ensureDir, formatBeijingTime } from './utils.js';
import { ensureAdminUser } from './services/authService.js';

ensureDir(config.uploadsDir);
ensureDir(config.processedDir);
ensureAdminUser();

const recoveredTaskCount = recoverInterruptedTasks();
if (recoveredTaskCount > 0) {
  console.warn(`Recovered ${recoveredTaskCount} interrupted task(s) after backend restart.`);
}

const proxyUrl = config.httpsProxy || config.httpProxy;
if (proxyUrl) {
  process.env.HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || proxyUrl;
  process.env.HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy || proxyUrl;
  if (config.noProxy) {
    process.env.NO_PROXY = process.env.NO_PROXY || process.env.no_proxy || config.noProxy;
  }
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  console.log(`Proxy enabled for outbound requests: ${proxyUrl}`);
} else {
  console.warn('No HTTP/HTTPS proxy configured. Google APIs may be unreachable from this server.');
}

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: packageInfo.version
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/users', userRoutes);
app.use('/api/landing', seoLandingRoutes);

app.use((error, req, res, next) => {
  console.error(`[${formatBeijingTime()}] ${req.method} ${req.originalUrl}`, error);
  if (req.file?.path && fs.existsSync(req.file.path)) {
    fs.unlinkSync(req.file.path);
  }
  res.status(400).json({
    message: error.message || 'Request failed',
    details: Array.isArray(error.details) ? error.details : undefined
  });
});

app.listen(config.port, config.host, () => {
  console.log(`Backend server running at http://${config.host}:${config.port}`);
});
