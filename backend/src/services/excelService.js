import ExcelJS from 'exceljs';
import path from 'path';
import { config } from '../config.js';
import { ensureDir, fileNameWithoutExt } from '../utils.js';

ensureDir(config.uploadsDir);
ensureDir(config.processedDir);

const DUPLICATE_KEYWORD_RECOMMENDED_LIMIT = 10000;
const DUPLICATE_KEYWORD_HARD_LIMIT = 20000;
const DUPLICATE_KEYWORD_BATCH_SIZE = 200;
const DUPLICATE_KEYWORD_RULE_VERSION = 'v3-grouped-output';

const DUPLICATE_KEYWORD_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'no',
  'not',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'today',
  'vs',
  'what',
  'when',
  'why',
  'with'
]);

const DUPLICATE_KEYWORD_WEAK_WORDS = new Set([
  'app',
  'apps',
  'best',
  'free',
  'online',
  'software',
  'tool',
  'tools'
]);

function normalizeHeaders(headerRow) {
  return headerRow.values
    .slice(1)
    .map((value) => String(value || '').trim());
}

function waitForNextTick() {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function readExcelRows(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  if (!worksheet || worksheet.rowCount < 2) {
    throw new Error('Excel file has no data');
  }

  const headers = normalizeHeaders(worksheet.getRow(1));
  const urlIndex = headers.findIndex((header) => header.toLowerCase() === 'url');

  if (urlIndex === -1) {
    throw new Error('Excel must contain a url column');
  }

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const item = {};
    headers.forEach((header, index) => {
      item[header] = row.getCell(index + 1).text || '';
    });
    item.url = item[headers[urlIndex]] || '';
    rows.push(item);
  });

  return { rows, headers };
}

export async function writeResultExcel(originalFileName, originalRows, resultRows, type) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('result');
  const mergedRows = originalRows.map((row, index) => ({
    ...row,
    ...resultRows[index]
  }));

  const headers = Array.from(
    mergedRows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  worksheet.addRow(headers);
  mergedRows.forEach((row) => {
    worksheet.addRow(headers.map((header) => row[header] ?? ''));
  });

  const outputFileName = `${fileNameWithoutExt(originalFileName)}-${type}-result-${Date.now()}.xlsx`;
  const outputPath = path.join(config.processedDir, outputFileName);
  await workbook.xlsx.writeFile(outputPath);

  return { outputFileName, outputPath };
}

function extractKeywordFromUrl(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) {
    return '';
  }

  let pathname = rawUrl;

  try {
    pathname = new URL(rawUrl).pathname || '';
  } catch {
    pathname = rawUrl.split('?')[0].split('#')[0];
  }

  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = decodeURIComponent(segments.at(-1) || '');
  const normalizedSegment = lastSegment.replace(/\.[a-z0-9]+$/i, '');

  return normalizedSegment
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getCanonicalWords(keyword) {
  const words = String(keyword || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => (
      Boolean(word)
      && !DUPLICATE_KEYWORD_STOP_WORDS.has(word)
      && !DUPLICATE_KEYWORD_WEAK_WORDS.has(word)
    ));

  return words.filter((word, index) => words.indexOf(word) === index);
}

function buildDuplicateGroups(keywordRows) {
  const groupMap = new Map();

  keywordRows.forEach((row, rowIndex) => {
    if (row.words.length < 3) {
      return;
    }

    const signature = [...row.words].sort().join(' ');
    if (!groupMap.has(signature)) {
      groupMap.set(signature, []);
    }
    groupMap.get(signature).push(rowIndex);
  });

  return Array.from(groupMap.entries())
    .filter(([, indexes]) => indexes.length >= 2)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([signature, indexes]) => ({
      indexes,
      duplicateWords: signature
    }));
}

export async function writeDuplicateKeywordExcel(originalFileName, rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('duplicate-keywords');

  worksheet.addRow(['页面地址', '原关键词', '重复词', '重复组', '规则版本']);

  rows.forEach((row) => {
    worksheet.addRow([
      row.pageUrl,
      row.originalKeyword,
      row.duplicateWords,
      row.duplicateGroup,
      DUPLICATE_KEYWORD_RULE_VERSION
    ]);
  });

  const outputFileName = `${fileNameWithoutExt(originalFileName)}-duplicate-keywords-${Date.now()}.xlsx`;
  const outputPath = path.join(config.processedDir, outputFileName);
  await workbook.xlsx.writeFile(outputPath);

  return { outputFileName, outputPath, rowCount: rows.length };
}

export function validateDuplicateKeywordRowCount(rowCount) {
  if (rowCount > DUPLICATE_KEYWORD_HARD_LIMIT) {
    throw new Error(`重复关键词筛选单次最多支持 ${DUPLICATE_KEYWORD_HARD_LIMIT} 条 URL，当前为 ${rowCount} 条`);
  }

  if (rowCount > DUPLICATE_KEYWORD_RECOMMENDED_LIMIT) {
    return `当前文件共 ${rowCount} 条 URL，已超过建议值 ${DUPLICATE_KEYWORD_RECOMMENDED_LIMIT}，处理时间会明显变长`;
  }

  return '';
}

export async function findDuplicateKeywordRows(filePath, originalFileName, options = {}) {
  const { rows } = await readExcelRows(filePath);
  const warningMessage = validateDuplicateKeywordRowCount(rows.length);
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const keywordRows = [];

  for (const [index, row] of rows.entries()) {
    const originalKeyword = extractKeywordFromUrl(row.url);
    keywordRows.push({
      pageUrl: row.url,
      originalKeyword,
      words: getCanonicalWords(originalKeyword)
    });

    if (onProgress && (index + 1) % DUPLICATE_KEYWORD_BATCH_SIZE === 0) {
      onProgress(index + 1);
      await waitForNextTick();
    }
  }

  if (onProgress) {
    onProgress(rows.length);
  }

  const duplicateGroups = buildDuplicateGroups(keywordRows);
  const duplicateRows = [];

  for (const [groupIndex, group] of duplicateGroups.entries()) {
    const duplicateGroup = `G${String(groupIndex + 1).padStart(4, '0')}`;

    group.indexes.forEach((rowIndex) => {
      const currentRow = keywordRows[rowIndex];
      duplicateRows.push({
        pageUrl: currentRow.pageUrl,
        originalKeyword: currentRow.originalKeyword,
        duplicateWords: group.duplicateWords,
        duplicateGroup
      });
    });

    if ((groupIndex + 1) % DUPLICATE_KEYWORD_BATCH_SIZE === 0) {
      await waitForNextTick();
    }
  }

  const result = await writeDuplicateKeywordExcel(originalFileName, duplicateRows);

  return {
    ...result,
    warningMessage
  };
}
