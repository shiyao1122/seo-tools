import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { getSettings } from '../services/settingsService.js';
import { runGoogleApiTest } from '../services/googleService.js';
import { findDuplicateKeywordRows } from '../services/excelService.js';
import { generateTemplateSchemaJson, getTemplateSchemaBundle, importTemplateSchemaContent } from '../services/templateSchemaService.js';
import { ensureDir } from '../utils.js';

const router = Router();
ensureDir(config.uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.use(requireAuth);

router.get('/template-schema/config', (req, res) => {
  res.json(getTemplateSchemaBundle());
});

router.post('/template-schema/generate', (req, res, next) => {
  try {
    const data = generateTemplateSchemaJson(req.body?.formData || {});
    res.json({
      data
    });
  } catch (error) {
    next(error);
  }
});

router.post('/template-schema/import', upload.single('file'), async (req, res, next) => {
  try {
    const data = await importTemplateSchemaContent({
      text: req.body?.text || '',
      filePath: req.file?.path || '',
      originalName: req.file?.originalname || ''
    });

    res.json({ data });
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

router.get('/template', (req, res) => {
  if (!fs.existsSync(config.templateFile)) {
    return res.status(404).json({ message: '模板文件不存在' });
  }

  return res.download(config.templateFile, 'temp.xlsx');
});

router.post('/test', async (req, res) => {
  const settings = getSettings();
  const result = await runGoogleApiTest({
    type: req.body?.type,
    url: req.body?.url,
    siteUrl: settings.siteUrl,
    serviceAccountJson: settings.serviceAccountJson
  });

  res.json(result);
});

router.post('/duplicate-keywords', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请上传 Excel 文件' });
    }

    const { outputFileName, outputPath } = await findDuplicateKeywordRows(req.file.path, req.file.originalname);

    res.download(outputPath, outputFileName, (error) => {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      if (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
