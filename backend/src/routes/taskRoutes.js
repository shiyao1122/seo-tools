import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { createTask, deleteTask, getDownloadFile, listTasks, stopTask } from '../services/taskService.js';
import { ensureDir } from '../utils.js';

ensureDir(config.uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });
const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(listTasks(req.query.type));
});

router.post('/indexing', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请上传 Excel 文件' });
    }
    const task = await createTask('indexing', req.file);
    return res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post('/inspection', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请上传 Excel 文件' });
    }
    const task = await createTask('inspection', req.file);
    return res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post('/duplicate-keywords', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请上传 Excel 文件' });
    }
    const task = await createTask('duplicate-keywords', req.file);
    return res.json(task);
  } catch (error) {
    next(error);
  }
});

router.get('/:taskId/download', (req, res) => {
  const file = getDownloadFile(req.params.taskId);
  if (!file) {
    return res.status(404).json({ message: '结果文件不存在' });
  }
  return res.download(file.path, file.fileName);
});

router.post('/:taskId/stop', async (req, res, next) => {
  try {
    return res.json(await stopTask(req.params.taskId));
  } catch (error) {
    next(error);
  }
});

router.delete('/:taskId', (req, res, next) => {
  try {
    return res.json(deleteTask(req.params.taskId));
  } catch (error) {
    next(error);
  }
});

export default router;
