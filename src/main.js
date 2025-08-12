const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const execa = require('execa');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

if (!ffmpegPath) {
  console.error('未找到 ffmpeg 可执行文件，请确认 ffmpeg-static 已安装');
}

let win;
function createWindow () {
  win = new BrowserWindow({
    width: 1100, height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// --- Helpers ---
async function pickIntro() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '选择片头 (mp4)',
    filters: [{ name: 'Videos', extensions: ['mp4'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths[0]) return null;
  return filePaths[0];
}

async function pickMains() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '选择正片 (可多选)',
    filters: [{ name: 'Videos', extensions: ['mp4'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (canceled || !filePaths.length) return [];
  return filePaths;
}

async function pickOutputDir() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '选择输出目录',
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || !filePaths[0]) return null;
  return filePaths[0];
}

function buildFilter(preset) {
  if (preset === 'passthrough') return null;
  const [wh, fps] = preset.split('@');
  const [w, h] = wh.split('x').map(Number);
  const vf = `fps=${fps},scale=w=${w}:h=${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`;
  return { w, h, fps: Number(fps), vf };
}

async function probeDuration(file) {
  try{
    const { stdout } = await execa(ffprobePath, [
      '-v','error','-select_streams','v:0','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',
      file
    ]);
    const d = parseFloat(stdout.trim());
    return isNaN(d) ? 0 : d;
  }catch(e){ return 0; }
}

function parseTimecode(stderrChunk){
  // 从 ffmpeg 日志中提取 time=hh:mm:ss.xx
  const m = /time=(\d+):(\d+):(\d+\.\d+)/.exec(stderrChunk);
  if(!m) return null;
  const h = parseInt(m[1],10), mi = parseInt(m[2],10), s = parseFloat(m[3]);
  return h*3600 + mi*60 + s;
}

function buildArgs(intro, main, outFile, options){
  const { filter, vbit, abit } = options;
  const vBit = `${vbit}k`, aBit = `${abit}k`;
  if(filter && filter.vf){
    return [
      '-y',
      '-i', intro,
      '-i', main,
      '-filter_complex', `[0:v]${filter.vf}[iv];[1:v]${filter.vf}[mv];[iv][0:a][mv][1:a]concat=n=2:v=1:a=1[v][a]`,
      '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-b:v', vBit, '-preset', 'veryfast',
      '-c:a', 'aac', '-b:a', aBit,
      '-movflags', '+faststart',
      outFile
    ];
  } else {
    return [
      '-y',
      '-i', intro,
      '-i', main,
      '-filter_complex', `[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]`,
      '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-b:v', vBit, '-preset', 'veryfast',
      '-c:a', 'aac', '-b:a', aBit,
      '-movflags', '+faststart',
      outFile
    ];
  }
}

async function runJob(job, sendProgress){
  const { intro, main, outDir, options } = job;
  const base = path.basename(main).replace(/\.mp4$/i, '');
  const outFile = path.join(outDir, `${base}_with_intro.mp4`);
  const args = buildArgs(intro, main, outFile, options);
  const mainDur = await probeDuration(main);
  const totalDur = mainDur; // 进度以主视频时长估算

  return new Promise((resolve,reject)=>{
    const proc = execa(ffmpegPath, args);
    proc.stderr.on('data', chunk => {
      const str = chunk.toString();
      const t = parseTimecode(str);
      if (t!=null && totalDur>0) {
        let pct = Math.round(Math.min(100, (t/totalDur)*100));
        sendProgress({ file: main, percent: pct });
      }
    });
    proc.on('close', code => {
      if(code===0) resolve(outFile);
      else reject(new Error('ffmpeg exited with code '+code));
    });
  });
}

async function runQueue(payload, onEvent){
  const { intro, mains, outDir, preset, vbit, abit, concurrency } = payload;
  const filter = buildFilter(preset);
  const jobs = mains.map(m => ({ intro, main: m, outDir, options: { filter, vbit, abit } }));
  let current = 0, ok = 0, fail = 0;
  const inFlight = new Set();

  async function launchNext(){
    if(current >= jobs.length) return;
    const job = jobs[current++];
    inFlight.add(job);
    onEvent({ type:'job-start', file: job.main, index: current, total: jobs.length });
    try{
      await runJob(job, (prog)=> onEvent({ type:'job-progress', ...prog }));
      ok++;
      onEvent({ type:'job-done', file: job.main, ok, fail });
    }catch(e){
      fail++;
      onEvent({ type:'job-fail', file: job.main, message: e.message, ok, fail });
    } finally {
      inFlight.delete(job);
      if (current < jobs.length) launchNext();
      if (inFlight.size===0 && current>=jobs.length) onEvent({ type:'all-done', ok, fail, total: jobs.length });
    }
  }

  const c = Math.max(1, Math.min(concurrency||2, 8));
  for(let i=0;i<c && i<jobs.length;i++) launchNext();
}

ipcMain.handle('pick-intro', async ()=> await pickIntro());
ipcMain.handle('pick-mains', async ()=> await pickMains());
ipcMain.handle('pick-outdir', async ()=> await pickOutputDir());
ipcMain.on('start', async (evt, payload) => {
  runQueue(payload, (event)=> {
    win.webContents.send('event', event);
  });
});
