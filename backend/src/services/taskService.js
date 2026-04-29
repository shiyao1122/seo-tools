import fs from 'fs';
import path from 'path';
import { readDb, updateDb } from '../db.js';
import { createId, formatBeijingTime, sleep } from '../utils.js';
import { findDuplicateKeywordRows, readExcelRows, validateDuplicateKeywordRowCount, writeResultExcel } from './excelService.js';
import { getSettings } from './settingsService.js';
import { inspectUrlIndexStatus, submitIndexingUrl } from './googleService.js';

const taskQueue = [];
let running = false;

class TaskStoppedError extends Error {
  constructor(result) {
    super('任务已停止');
    this.name = 'TaskStoppedError';
    this.result = result;
  }
}

function safeUnlink(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function isRecoverableInterruptedTask(task) {
  return task.status === 'queued' || task.status === 'running' || task.status === 'stopping';
}

function persistTask(task) {
  updateDb((db) => ({
    ...db,
    tasks: [task, ...db.tasks.filter((item) => item.id !== task.id)]
  }));
  return task;
}

function updateTask(taskId, updater) {
  let updatedTask = null;
  updateDb((db) => {
    const tasks = db.tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }
      updatedTask = updater(task);
      return updatedTask;
    });
    return { ...db, tasks };
  });
  return updatedTask;
}

function getTaskById(taskId) {
  return readDb().tasks.find((task) => task.id === taskId) || null;
}

function shouldStopTask(taskId) {
  const task = getTaskById(taskId);
  return task?.status === 'stopping' || task?.stopRequested === true;
}

async function buildTaskResultFile(task, rows, resultRows, type, successCount, extra = {}) {
  const resultFile = await writeResultExcel(task.originalFileName, rows, resultRows, type);

  return {
    processedCount: resultRows.length,
    successCount,
    failedCount: resultRows.length - successCount,
    resultFileName: resultFile.outputFileName,
    resultFilePath: resultFile.outputPath,
    ...extra
  };
}

async function processIndexingTask(task) {
  const settings = getSettings();
  const { rows } = await readExcelRows(task.originalFilePath);
  const resultRows = [];
  let successCount = 0;

  for (const row of rows) {
    if (shouldStopTask(task.id)) {
      throw new TaskStoppedError(await buildTaskResultFile(task, rows, resultRows, 'indexing', successCount));
    }

    const url = String(row.url || '').trim();
    if (!url) {
      resultRows.push({ submit_status: 'failed', submit_message: 'url 为空', submit_time: formatBeijingTime() });
    } else {
      try {
        await submitIndexingUrl(url, settings.serviceAccountJson);
        successCount += 1;
        resultRows.push({ submit_status: 'success', submit_message: '提交成功', submit_time: formatBeijingTime() });
      } catch (error) {
        resultRows.push({ submit_status: 'failed', submit_message: error.message, submit_time: formatBeijingTime() });
      }

      await sleep(settings.submitDelayMs);
    }

    updateTask(task.id, (current) => ({
      ...current,
      processedCount: resultRows.length,
      successCount,
      failedCount: resultRows.length - successCount
    }));
  }

  return buildTaskResultFile(task, rows, resultRows, 'indexing', successCount);
}

function parseInspectionResult(result) {
  const indexResult = result?.inspectionResult?.indexStatusResult;
  const verdict = indexResult?.verdict || 'UNKNOWN';
  const coverageState = indexResult?.coverageState || '';
  const indexingState = indexResult?.indexingState || '';
  const lastCrawlTime = indexResult?.lastCrawlTime || '';
  const indexed = verdict === 'PASS' || /submitted and indexed|indexed/i.test(`${coverageState} ${indexingState}`);

  return {
    indexed: indexed ? 'yes' : 'no',
    inspection_verdict: verdict,
    inspection_coverage: coverageState,
    inspection_indexing_state: indexingState,
    inspection_last_crawl_time: lastCrawlTime
  };
}

async function processInspectionTask(task) {
  const settings = getSettings();
  const { rows } = await readExcelRows(task.originalFilePath);
  const resultRows = [];
  let successCount = 0;

  for (const row of rows) {
    if (shouldStopTask(task.id)) {
      throw new TaskStoppedError(await buildTaskResultFile(task, rows, resultRows, 'inspection', successCount));
    }

    const url = String(row.url || '').trim();
    if (!url) {
      resultRows.push({ inspect_status: 'failed', inspect_message: 'url 为空', inspect_time: formatBeijingTime(), indexed: 'unknown' });
    } else {
      try {
        const result = await inspectUrlIndexStatus(url, settings.siteUrl, settings.serviceAccountJson);
        successCount += 1;
        resultRows.push({
          inspect_status: 'success',
          inspect_message: '查询成功',
          inspect_time: formatBeijingTime(),
          ...parseInspectionResult(result)
        });
      } catch (error) {
        resultRows.push({ inspect_status: 'failed', inspect_message: error.message, inspect_time: formatBeijingTime(), indexed: 'unknown' });
      }

      await sleep(settings.queryDelayMs);
    }

    updateTask(task.id, (current) => ({
      ...current,
      processedCount: resultRows.length,
      successCount,
      failedCount: resultRows.length - successCount
    }));
  }

  return buildTaskResultFile(task, rows, resultRows, 'inspection', successCount);
}

async function processDuplicateKeywordTask(task) {
  const { rows } = await readExcelRows(task.originalFilePath);

  validateDuplicateKeywordRowCount(rows.length);

  const resultFile = await findDuplicateKeywordRows(task.originalFilePath, task.originalFileName, {
    onProgress(processedCount) {
      updateTask(task.id, (current) => ({
        ...current,
        processedCount
      }));
    }
  });

  return {
    processedCount: rows.length,
    successCount: resultFile.rowCount,
    failedCount: 0,
    resultFileName: resultFile.outputFileName,
    resultFilePath: resultFile.outputPath,
    warningMessage: resultFile.warningMessage || ''
  };
}

async function processTask(task) {
  updateTask(task.id, (current) => ({
    ...current,
    status: 'running',
    stopRequested: false,
    startedAt: formatBeijingTime()
  }));

  try {
    let result;

    if (task.type === 'indexing') {
      result = await processIndexingTask(task);
    } else if (task.type === 'inspection') {
      result = await processInspectionTask(task);
    } else if (task.type === 'duplicate-keywords') {
      result = await processDuplicateKeywordTask(task);
    } else {
      throw new Error(`Unsupported task type: ${task.type}`);
    }

    updateTask(task.id, (current) => ({
      ...current,
      ...result,
      status: 'completed',
      stopRequested: false,
      completedAt: formatBeijingTime()
    }));
  } catch (error) {
    if (error instanceof TaskStoppedError) {
      updateTask(task.id, (current) => ({
        ...current,
        ...error.result,
        status: 'stopped',
        stopRequested: false,
        errorMessage: '',
        completedAt: formatBeijingTime()
      }));
      return;
    }

    updateTask(task.id, (current) => ({
      ...current,
      status: 'failed',
      stopRequested: false,
      errorMessage: error.message,
      completedAt: formatBeijingTime()
    }));
  }
}

async function drainQueue() {
  if (running) {
    return;
  }

  running = true;
  while (taskQueue.length) {
    const task = taskQueue.shift();
    await processTask(task);
  }
  running = false;
}

export async function createTask(type, file) {
  const { rows } = await readExcelRows(file.path);
  const task = {
    id: createId(type),
    type,
    status: 'queued',
    originalFileName: file.originalname,
    originalFilePath: file.path,
    uploadedAt: formatBeijingTime(),
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    totalCount: rows.length,
    resultFileName: '',
    resultFilePath: '',
    errorMessage: '',
    stopRequested: false,
    warningMessage: type === 'duplicate-keywords' ? validateDuplicateKeywordRowCount(rows.length) : ''
  };

  persistTask(task);
  taskQueue.push(task);
  void drainQueue();
  return task;
}

export function listTasks(type) {
  return readDb().tasks.filter((task) => !type || task.type === type);
}

export function getDownloadFile(taskId) {
  const task = readDb().tasks.find((item) => item.id === taskId);
  if (!task || !task.resultFilePath || !fs.existsSync(task.resultFilePath)) {
    return null;
  }

  return {
    path: task.resultFilePath,
    fileName: path.basename(task.resultFilePath)
  };
}

export async function stopTask(taskId) {
  const task = getTaskById(taskId);

  if (!task) {
    throw new Error('任务不存在');
  }

  if (!['indexing', 'inspection'].includes(task.type)) {
    throw new Error('当前任务类型不支持停止');
  }

  if (task.status === 'completed' || task.status === 'failed' || task.status === 'stopped') {
    throw new Error('当前任务状态不允许停止');
  }

  if (task.status === 'queued') {
    const queueIndex = taskQueue.findIndex((item) => item.id === taskId);
    if (queueIndex !== -1) {
      taskQueue.splice(queueIndex, 1);
    }

    const { rows } = await readExcelRows(task.originalFilePath);
    const result = await buildTaskResultFile(task, rows, [], task.type, 0);

    return updateTask(taskId, (current) => ({
      ...current,
      ...result,
      status: 'stopped',
      stopRequested: false,
      completedAt: formatBeijingTime()
    }));
  }

  return updateTask(taskId, (current) => ({
    ...current,
    status: 'stopping',
    stopRequested: true
  }));
}

export function deleteTask(taskId) {
  const db = readDb();
  const task = db.tasks.find((item) => item.id === taskId);

  if (!task) {
    throw new Error('任务不存在');
  }

  if (task.status === 'running' || task.status === 'stopping') {
    throw new Error('运行中的任务不允许删除');
  }

  const queueIndex = taskQueue.findIndex((item) => item.id === taskId);
  if (queueIndex !== -1) {
    taskQueue.splice(queueIndex, 1);
  }

  safeUnlink(task.originalFilePath);
  safeUnlink(task.resultFilePath);

  updateDb((current) => ({
    ...current,
    tasks: current.tasks.filter((item) => item.id !== taskId)
  }));

  return { success: true };
}

export function recoverInterruptedTasks() {
  let recoveredCount = 0;

  updateDb((db) => {
    const tasks = db.tasks.map((task) => {
      if (!isRecoverableInterruptedTask(task)) {
        return task;
      }

      recoveredCount += 1;
      return {
        ...task,
        status: 'failed',
        stopRequested: false,
        errorMessage: '任务因后台重启而中断，请重新执行',
        completedAt: formatBeijingTime()
      };
    });

    return { ...db, tasks };
  });

  return recoveredCount;
}
