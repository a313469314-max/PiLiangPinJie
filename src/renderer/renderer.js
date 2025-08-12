const $ = (s)=>document.querySelector(s);
let introPath = null;
let mains = [];
let outDir = null;

function log(msg){
  const el = $('#log');
  el.textContent += msg + '\n';
  el.scrollTop = el.scrollHeight;
}
function listMains(){
  const box = $('#mainList'); box.innerHTML = '';
  mains.forEach(f=>{
    const div = document.createElement('div');
    div.className = 'tile'; div.textContent = f;
    box.appendChild(div);
  });
  $('#mainsCount').textContent = `已选 ${mains.length} 个文件`;
}

$('#btnIntro').addEventListener('click', async ()=>{
  introPath = await window.api.pickIntro();
  $('#introPath').textContent = introPath || '';
});
$('#btnMains').addEventListener('click', async ()=>{
  mains = await window.api.pickMains();
  listMains();
});
$('#btnOut').addEventListener('click', async ()=>{
  outDir = await window.api.pickOutdir();
  $('#outPath').textContent = outDir || '';
});

$('#btnStart').addEventListener('click', async ()=>{
  if(!introPath){ alert('请先选择片头'); return; }
  if(!mains || mains.length===0){ alert('请至少选择 1 个正片'); return; }
  if(!outDir){ alert('请选择输出目录'); return; }

  const preset = $('#preset').value;
  const vbit = parseInt($('#vbit').value, 10) || 3500;
  const abit = parseInt($('#abit').value, 10) || 160;
  const concurrency = parseInt($('#concurrency').value, 10) || 2;

  $('#status').textContent = '处理中...';
  $('#progress').value = 0; $('#progressText').textContent = '0%';
  $('#log').textContent = '';
  let finished = 0;

  window.api.start({ intro: introPath, mains, outDir, preset, vbit, abit, concurrency });

  window.api.onEvent((e)=>{
    if(e.type==='job-start'){
      log(`→ 开始：${e.file}`);
    } else if(e.type==='job-progress'){
      // 单文件进度 e.percent
      // 汇总进度：已完成数量 + 当前文件占比
    } else if(e.type==='job-done'){
      finished++;
      const pct = Math.round((finished / mains.length)*100);
      $('#progress').value = pct; $('#progressText').textContent = pct + '%';
      log(`✓ 完成：${e.file}`);
    } else if(e.type==='job-fail'){
      finished++;
      const pct = Math.round((finished / mains.length)*100);
      $('#progress').value = pct; $('#progressText').textContent = pct + '%';
      log(`✗ 失败：${e.file} ｜ ${e.message}`);
    } else if(e.type==='all-done'){
      $('#status').textContent = `完成：成功 ${e.ok}，失败 ${e.fail}`;
      log('全部处理完成');
    }
  });
});
