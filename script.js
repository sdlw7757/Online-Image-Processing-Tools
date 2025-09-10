const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const fileList = document.getElementById('fileList');
const toolSelect = document.getElementById('toolSelect');
const formatSelect = document.getElementById('formatSelect');
const qualityRange = document.getElementById('qualityRange');
const qualityVal = document.getElementById('qualityVal');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const lockRatio = document.getElementById('lockRatio');
const brightnessRange = document.getElementById('brightnessRange');
const contrastRange = document.getElementById('contrastRange');
const saturateRange = document.getElementById('saturateRange');
const brightnessVal = document.getElementById('brightnessVal');
const contrastVal = document.getElementById('contrastVal');
const saturateVal = document.getElementById('saturateVal');
const aspectSelect = document.getElementById('aspectSelect');
const previewBtn = document.getElementById('previewBtn');
const downloadBtn = document.getElementById('downloadBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const previewCanvas = document.getElementById('previewCanvas');
const ctx = previewCanvas ? previewCanvas.getContext('2d') : null;
const clearBtn = document.getElementById('clearBtn');
const icoSizesGroup = document.getElementById('icoSizes');
const prevBtn = document.getElementById('prevBtn');  // 添加上一页按钮
const nextBtn = document.getElementById('nextBtn');  // 添加下一页按钮
const previewCounter = document.getElementById('previewCounter');  // 添加预览计数器
const unitSelect = document.getElementById('unitSelect'); // 添加单位选择
const formatIndicator = document.getElementById('formatIndicator'); // 添加格式指示器
const resetBtn = document.getElementById('resetBtn'); // 添加初始化按钮

// 统一文件状态
let selectedFiles = [];
let currentPreviewIndex = 0;  // 添加当前预览图片索引

// 裁剪交互状态（相对画布像素）
let isCropping = false;
let cropStart = null; // {x,y}
let cropRect = null;  // {x,y,w,h}

// 默认DPI（用于尺寸单位转换）
const DEFAULT_DPI = 96;

// 单位转换函数
function convertToPixels(value, unit, dpi = DEFAULT_DPI, originalSize = null) {
  switch(unit) {
    case 'pixels':
      return Math.round(value);
    case 'percentage':
      // 对于百分比，需要原始尺寸来计算
      if (originalSize) {
        return Math.round(originalSize * value / 100);
      }
      return Math.round(value);
    case 'inches':
      return Math.round(value * dpi);
    case 'centimeters':
      return Math.round(value * dpi / 2.54);
    default:
      return Math.round(value);
  }
}

function convertFromPixels(pixels, unit, dpi = DEFAULT_DPI, originalSize = null) {
  switch(unit) {
    case 'pixels':
      return pixels;
    case 'percentage':
      // 对于百分比，需要原始尺寸来计算
      if (originalSize && originalSize > 0) {
        return Math.round(pixels * 100 / originalSize);
      }
      return pixels;
    case 'inches':
      return (pixels / dpi).toFixed(2);
    case 'centimeters':
      return (pixels * 2.54 / dpi).toFixed(2);
    default:
      return pixels;
  }
}

function formatBytes(bytes){
  const units = ['B','KB','MB','GB'];
  let size = bytes;
  let unitIndex = 0;
  while(size >= 1024 && unitIndex < units.length - 1){
    size /= 1024; unitIndex++;
  }
  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

function createFileCard(file, errorMsg){
  const card = document.createElement('div');
  card.className = 'file-card';

  const name = document.createElement('div');
  name.className = 'file-name';
  name.textContent = file.name;

  const meta = document.createElement('div');
  meta.className = 'file-meta';
  meta.textContent = `${file.type || '未知类型'} • ${formatBytes(file.size)}`;

  // 添加删除按钮
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'secondary-btn';
  deleteBtn.textContent = '删除';
  deleteBtn.style.cssText = 'padding: 2px 6px; font-size: 12px; margin-left: 10px;';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 通过文件名、大小和修改时间找到要删除的文件索引
    const fileIndex = selectedFiles.findIndex(f => 
      f.name === file.name && 
      f.size === file.size && 
      f.lastModified === file.lastModified
    );
    
    if (fileIndex !== -1) {
      // 从selectedFiles数组中移除文件
      selectedFiles.splice(fileIndex, 1);
      
      // 如果删除的是当前预览的图片，重置当前预览索引
      if (fileIndex === currentPreviewIndex) {
        currentPreviewIndex = 0;
      } else if (fileIndex < currentPreviewIndex) {
        // 如果删除的文件在当前预览文件之前，需要调整当前预览索引
        currentPreviewIndex--;
      }
      
      // 重新渲染文件列表
      renderFileList();
      // 更新预览计数器
      updatePreviewCounter();
      // 清空预览画布
      if(previewCanvas && ctx){ 
        ctx.clearRect(0,0,previewCanvas.width, previewCanvas.height); 
        previewCanvas.width = 0; 
        previewCanvas.height = 0; 
      }
    }
  });

  const nameContainer = document.createElement('div');
  nameContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  nameContainer.appendChild(name);
  nameContainer.appendChild(deleteBtn);

  card.appendChild(nameContainer);
  card.appendChild(meta);

  if(errorMsg){
    const err = document.createElement('div');
    err.className = 'file-error';
    err.textContent = errorMsg;
    card.appendChild(err);
  }

  fileList.appendChild(card);
}

// 添加重新渲染文件列表的函数
function renderFileList() {
  // 清空文件列表
  fileList.innerHTML = '';
  
  // 重新创建所有文件卡片
  selectedFiles.forEach((file, index) => {
    createFileCard(file);
  });
  
  // 更新预览计数器
  updatePreviewCounter();
}

function fileKey(f){
  return `${f.name}|${f.size}|${f.lastModified}`;
}

function handleFiles(files, {append=false}={}){
  if(!append){
    fileList.innerHTML = '';
    selectedFiles = [];
    currentPreviewIndex = 0;  // 重置索引
    updatePreviewCounter();   // 更新计数器显示
  }
  const seen = new Set(selectedFiles.map(fileKey));
  [...files].forEach(file => {
    if(file.size > MAX_FILE_SIZE){
      createFileCard(file, '文件超过 50MB 限制');
      return;
    }
    const k = fileKey(file);
    if(seen.has(k)) return; // 去重
    seen.add(k);
    selectedFiles.push(file);
    createFileCard(file);
  });
  updatePreviewCounter();  // 更新计数器显示
}

selectBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files, {append:true}));

['dragenter','dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.add('dragover');
  });
});
['dragleave','drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  if(dt && dt.files) handleFiles(dt.files, {append:true});
});

dropzone.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' || e.key === ' '){
    e.preventDefault();
    fileInput.click();
  }
});

// 添加尺寸和像素标签切换功能
function setupDimensionLabelToggle() {
  const dimensionLabel = document.getElementById('dimensionLabel');
  const pixelLabel = document.getElementById('pixelLabel');
  
  if (dimensionLabel && pixelLabel) {
    dimensionLabel.addEventListener('click', () => {
      dimensionLabel.classList.add('active');
      pixelLabel.classList.remove('active');
      // 可以在这里添加切换到尺寸模式的逻辑
    });
    
    pixelLabel.addEventListener('click', () => {
      pixelLabel.classList.add('active');
      dimensionLabel.classList.remove('active');
      // 可以在这里添加切换到像素模式的逻辑
    });
  }
}

// 添加单位选择变化事件监听器
unitSelect && unitSelect.addEventListener('change', () => {
  const unit = unitSelect.value;
  const first = selectedFiles[0];
  
  // 如果切换到百分比单位，设置默认值为100
  if (unit === 'percentage') {
    widthInput.value = '100';
    heightInput.value = '100';
  } 
  // 如果切换到像素单位且有选中的图片，设置为图片的实际尺寸
  else if (unit === 'pixels' && first) {
    loadImageBitmap(first).then(({width, height}) => {
      widthInput.value = width;
      heightInput.value = height;
    }).catch(() => {
      // 如果无法获取图片尺寸，清空输入框
      widthInput.value = '';
      heightInput.value = '';
    });
  }
  // 对于其他单位，清空输入框让用户重新输入
  else {
    widthInput.value = '';
    heightInput.value = '';
  }
  
  // 触发预览更新
  if (selectedFiles.length > 0) {
    previewCurrentImage();
  }
});

// 工具控制：动态显示控制项
function updateControlVisibility(){
  const current = toolSelect ? toolSelect.value : 'format';
  document.querySelectorAll('.control').forEach(el => {
    const show = el.getAttribute('data-show');
    if(!show){ el.style.display = ''; return; }
    el.style.display = show.split(' ').includes(current) ? '' : 'none';
  });
  
  // 更新格式指示器
  updateFormatIndicator();
  
  // 如果是调整尺寸工具且单位为百分比，确保输入框有默认值
  if (current === 'resize' && unitSelect && unitSelect.value === 'percentage') {
    if (!widthInput.value) widthInput.value = '100';
    if (!heightInput.value) heightInput.value = '100';
  }
}

toolSelect && toolSelect.addEventListener('change', updateControlVisibility);
updateControlVisibility();
setupDimensionLabelToggle(); // 初始化标签切换功能

// 添加格式选择变化事件监听器
formatSelect && formatSelect.addEventListener('change', updateFormatIndicator);

// 添加更新格式指示器的函数
function updateFormatIndicator() {
  if (!formatIndicator || !formatSelect) return;
  
  const formatValue = formatSelect.value;
  let formatText = 'PNG';
  
  switch(formatValue) {
    case 'image/jpeg':
      formatText = 'JPG';
      break;
    case 'image/png':
      formatText = 'PNG';
      break;
    case 'image/webp':
      formatText = 'WebP';
      break;
  }
  
  formatIndicator.textContent = formatText;
}

// 质量与编辑数值显示
qualityRange && qualityRange.addEventListener('input', () => qualityVal.textContent = Number(qualityRange.value).toFixed(2));
function bindPercent(range, label){
  if(!range || !label) return;
  const sync = () => label.textContent = `${range.value}%`;
  range.addEventListener('input', sync);
  sync();
}
bindPercent(brightnessRange, brightnessVal);
bindPercent(contrastRange, contrastVal);
bindPercent(saturateRange, saturateVal);

// 初始化格式指示器
updateFormatIndicator();

// 页面加载时的初始化
function initializeApp() {
  // 确保工具选择器默认为格式转换
  if(toolSelect) {
    toolSelect.value = 'format';
  }
  
  // 更新控制面板可见性
  updateControlVisibility();
  
  // 如果调整尺寸工具被选中且单位为百分比，设置默认值
  if (toolSelect && toolSelect.value === 'resize' && unitSelect && unitSelect.value === 'percentage') {
    widthInput.value = '100';
    heightInput.value = '100';
  }
  
  // 重置所有选择器到默认值
  if(formatSelect){ formatSelect.value = 'image/jpeg'; }
  if(qualityRange){ qualityRange.value = '1.0'; }
  if(qualityVal){ qualityVal.textContent = '1.00'; }
  if(unitSelect){ unitSelect.value = 'pixels'; }
  if(widthInput){ widthInput.value = ''; }
  if(heightInput){ heightInput.value = ''; }
  if(lockRatio){ lockRatio.checked = true; }
  if(brightnessRange){ brightnessRange.value = '100'; }
  if(contrastRange){ contrastRange.value = '100'; }
  if(saturateRange){ saturateRange.value = '100'; }
  if(aspectSelect){ aspectSelect.value = 'free'; }
  
  // 重置ICO尺寸选择
  if(icoSizesGroup){
    const checkboxes = icoSizesGroup.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox, index) => {
      // 默认只选中32尺寸（第二个）
      checkbox.checked = (index === 1);
    });
  }
  
  // 更新界面显示
  updateControlVisibility();
  updateFormatIndicator();
}

// 在页面加载完成后执行初始化
document.addEventListener('DOMContentLoaded', initializeApp);

// 加载图像为位图
function loadImageBitmap(file){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try{
        const bitmap = await createImageBitmap(img);
        URL.revokeObjectURL(url);
        resolve({bitmap, width: img.naturalWidth || bitmap.width, height: img.naturalHeight || bitmap.height});
      }catch(err){ reject(err); }
    };
    img.onerror = reject;
    img.src = url;
  });
}

function computeResizeSize(srcW, srcH){
  const unit = unitSelect ? unitSelect.value : 'pixels';
  let w = Number(widthInput && widthInput.value);
  let h = Number(heightInput && heightInput.value);
  
  // 如果没有输入值，使用默认值
  if (isNaN(w)) w = (unit === 'percentage') ? 100 : srcW;
  if (isNaN(h)) h = (unit === 'percentage') ? 100 : srcH;
  
  // 如果输入的是百分比，转换为像素
  if (unit === 'percentage') {
    w = Math.round(srcW * w / 100);
    h = Math.round(srcH * h / 100);
  } else if (unit === 'pixels') {
    // 像素值保持不变，但需要确保是有效数字
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
  } else {
    // 如果是其他单位（英寸或厘米），转换为像素
    w = convertToPixels(w, unit, DEFAULT_DPI, srcW);
    h = convertToPixels(h, unit, DEFAULT_DPI, srcH);
    // 确保最小尺寸为1
    w = Math.max(1, w);
    h = Math.max(1, h);
  }
  
  return {width: w, height: h};
}

function applyFilters(ctx){
  const brightness = brightnessRange ? Number(brightnessRange.value) : 100;
  const contrast = contrastRange ? Number(contrastRange.value) : 100;
  const saturate = saturateRange ? Number(saturateRange.value) : 100;
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
}

function computeCropRect(srcW, srcH){
  const aspect = aspectSelect ? aspectSelect.value : 'free';
  if(aspect === 'free'){ return {sx:0, sy:0, sw:srcW, sh:srcH}; }
  const [aw, ah] = aspect.split(':').map(Number);
  const targetRatio = aw/ah;
  const srcRatio = srcW/srcH;
  let sw = srcW, sh = srcH;
  if(srcRatio > targetRatio){
    sh = srcH;
    sw = Math.round(sh * targetRatio);
  }else{
    sw = srcW;
    sh = Math.round(sw / targetRatio);
  }
  const sx = Math.floor((srcW - sw)/2);
  const sy = Math.floor((srcH - sh)/2);
  return {sx, sy, sw, sh};
}

function getIcoSizes(){
  const boxes = icoSizesGroup ? icoSizesGroup.querySelectorAll('input[type="checkbox"]:checked') : [];
  const sizes = [...boxes].map(b => Number(b.value)).filter(v => v>0);
  return sizes.length ? sizes : [32];
}

async function processOne(file, isPreview = true){
  const current = toolSelect ? toolSelect.value : 'format';
  const outputType = formatSelect ? formatSelect.value : 'image/png';
  
  // 对于所有文件，我们需要先将其绘制到canvas上
  const {bitmap, width: srcW, height: srcH} = await loadImageBitmap(file);
  
  // 设置原始图片尺寸供裁剪坐标转换使用
  if (typeof window.setOriginalImageSize === 'function') {
    window.setOriginalImageSize(srcW, srcH);
  }
  
  let drawW = srcW, drawH = srcH, sx=0, sy=0, sw=srcW, sh=srcH;

  // 裁剪
  if(current === 'crop' && cropRect){
    let cropX, cropY, cropW, cropH;
    
    // 如果是预览模式，使用预览画布上的坐标
    if (isPreview) {
      cropX = Math.max(0, Math.min(previewCanvas.width, cropRect.x));
      cropY = Math.max(0, Math.min(previewCanvas.height, cropRect.y));
      cropW = Math.max(1, Math.min(previewCanvas.width - cropX, cropRect.w));
      cropH = Math.max(1, Math.min(previewCanvas.height - cropY, cropRect.h));
    } 
    // 如果是下载模式，需要将预览坐标转换为原始图片坐标
    else {
      // 使用转换函数将预览坐标转换为原始图片坐标
      if (typeof window.convertCropRectToOriginal === 'function') {
        const originalCropRect = window.convertCropRectToOriginal(cropRect, previewCanvas.width, previewCanvas.height);
        cropX = Math.max(0, Math.min(srcW, originalCropRect.x));
        cropY = Math.max(0, Math.min(srcH, originalCropRect.y));
        cropW = Math.max(1, Math.min(srcW - cropX, originalCropRect.w));
        cropH = Math.max(1, Math.min(srcH - cropY, originalCropRect.h));
      } else {
        // 备用方案：直接使用预览坐标并按比例转换
        const scaleX = srcW / previewCanvas.width;
        const scaleY = srcH / previewCanvas.height;
        cropX = Math.max(0, Math.min(srcW, Math.round(cropRect.x * scaleX)));
        cropY = Math.max(0, Math.min(srcH, Math.round(cropRect.y * scaleY)));
        cropW = Math.max(1, Math.min(srcW - cropX, Math.round(cropRect.w * scaleX)));
        cropH = Math.max(1, Math.min(srcH - cropY, Math.round(cropRect.h * scaleY)));
      }
    }
    
    sx = Math.round(cropX);
    sy = Math.round(cropY);
    sw = Math.round(cropW);
    sh = Math.round(cropH);
    drawW = sw; drawH = sh;
  }else if(current === 'crop'){
    ({sx, sy, sw, sh} = computeCropRect(srcW, srcH));
    drawW = sw; drawH = sh;
  }

  // 调整尺寸
  if(current === 'resize'){
    const size = computeResizeSize(sw, sh);
    drawW = size.width; drawH = size.height;
  }

  // 设置画布尺寸
  let canvasW = drawW, canvasH = drawH;
  
  // ICO处理
  if(current === 'ico'){
    const sizes = getIcoSizes();
    const icoMax = Math.max(...sizes);
    canvasW = icoMax; canvasH = icoMax;
  } 
  // 预览模式下的固定尺寸处理
  else if(isPreview && current !== 'ico') {
    // 获取预览容器的尺寸
    const previewWrap = document.querySelector('.preview-wrap');
    const containerW = previewWrap ? previewWrap.clientWidth - 24 : 500; // 减去padding
    const containerH = previewWrap ? previewWrap.clientHeight - 24 : 500; // 减去padding
    
    // 计算适应容器的最大尺寸
    const scale = Math.min(containerW / drawW, containerH / drawH, 1);
    canvasW = Math.floor(drawW * scale);
    canvasH = Math.floor(drawH * scale);
  }
  
  previewCanvas.width = canvasW;
  previewCanvas.height = canvasH;
  ctx.clearRect(0,0,canvasW,canvasH);

  // 过滤器
  applyFilters(ctx);
  
  // ICO处理
  if(current === 'ico'){
    const scale = Math.max(canvasW / sw, canvasH / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    const dx = Math.round((canvasW - dw) / 2);
    const dy = Math.round((canvasH - dh) / 2);
    ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
    // ICO 导出：多尺寸打包
    const pngBlob = await new Promise(resolve => previewCanvas.toBlob(resolve, 'image/png'));
    const basePng = new Uint8Array(await pngBlob.arrayBuffer());
    const sizes = getIcoSizes();
    const entries = [];
    for(const s of sizes){
      // 为每个尺寸重绘到临时画布
      const t = document.createElement('canvas');
      t.width = s; t.height = s;
      const tctx = t.getContext('2d');
      tctx.filter = ctx.filter;
      const scale = Math.max(s / sw, s / sh);
      const dw = Math.round(sw * scale);
      const dh = Math.round(sh * scale);
      const dx = Math.round((s - dw) / 2);
      const dy = Math.round((s - dh) / 2);
      tctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
      const pngS = await new Promise(r => t.toBlob(r, 'image/png'));
      const ab = new Uint8Array(await pngS.arrayBuffer());
      entries.push({size:s, data:ab});
    }
    const ico = buildMultiPngIco(entries);
    return ico;
  } 
  // 普通处理
  else {
    if(isPreview) {
      // 预览模式 - 适应固定尺寸预览框
      const scale = Math.min(canvasW / drawW, canvasH / drawH);
      const dw = Math.floor(drawW * scale);
      const dh = Math.floor(drawH * scale);
      const dx = Math.floor((canvasW - dw) / 2);
      const dy = Math.floor((canvasH - dh) / 2);
      ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
    } else {
      // 下载模式 - 使用实际处理尺寸
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, drawW, drawH);
      // 重新设置画布尺寸为实际处理尺寸
      previewCanvas.width = drawW;
      previewCanvas.height = drawH;
      ctx.clearRect(0,0,drawW,drawH);
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, drawW, drawH);
    }
  }

  // 常规导出
  const quality = qualityRange ? Number(qualityRange.value) : 1.0;
  
  // 对于所有格式，使用canvas的toBlob方法
  const blob = await new Promise(resolve => previewCanvas.toBlob(resolve, outputType, quality));
  
  // 如果是裁剪操作，重置裁剪状态
  if (current === 'crop') {
    // 重置裁剪状态，禁止下一次裁剪（只裁剪一次）
    if (typeof resetCropState === 'function') {
      resetCropState();
      // 确保裁剪被禁用
      isCropAllowed = false;
    }
  }
  
  return blob;
}

function makeDownload(filename, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function outputFilename(inputName, mime){
  const base = inputName.replace(/\.[^.]+$/, '');
  const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const ext = extMap[mime] || 'png';
  // 添加处理标识，使文件名更清晰
  return `${base}_processed.${ext}`;
}

function outputFilenameForTool(inputName){
  const current = toolSelect ? toolSelect.value : 'format';
  if(current === 'ico') return inputName.replace(/\.[^.]+$/, '') + '_processed.ico';
  return outputFilename(inputName, formatSelect.value);
}

previewBtn && previewBtn.addEventListener('click', async () => {
  const first = selectedFiles[0];
  if(!first){ alert('请先选择图片'); return; }
  currentPreviewIndex = 0;  // 重置到第一张图片
  updatePreviewCounter();   // 更新计数器
  try{ await processOne(first, true); }catch(err){ console.error(err); alert('预览失败'); }
});

downloadBtn && downloadBtn.addEventListener('click', async () => {
  const first = selectedFiles[0];
  if(!first){ alert('请先选择图片'); return; }
  // 在下载前隐藏裁剪覆盖层
  hideCropOverlay();
  try{
    const blob = await processOne(first, false);
    makeDownload(outputFilenameForTool(first.name), blob);
  }catch(err){ console.error(err); alert('导出失败'); }
  // 下载完成后移除裁剪覆盖层
  removeCropOverlay();
});

// 添加上一页按钮事件监听器
prevBtn && prevBtn.addEventListener('click', () => {
  if (selectedFiles.length === 0) return;
  switchPreviewImage(currentPreviewIndex - 1);
});

// 添加下一页按钮事件监听器
nextBtn && nextBtn.addEventListener('click', () => {
  if (selectedFiles.length === 0) return;
  switchPreviewImage(currentPreviewIndex + 1);
});

// 添加更新预览计数器的函数
function updatePreviewCounter() {
  if (previewCounter && selectedFiles.length > 0) {
    previewCounter.textContent = `${currentPreviewIndex + 1} / ${selectedFiles.length}`;
    previewCounter.style.display = 'inline-block';
  } else if (previewCounter) {
    previewCounter.style.display = 'none';
  }
  
  // 更新按钮状态
  if (prevBtn) {
    prevBtn.disabled = selectedFiles.length <= 1 || currentPreviewIndex <= 0;
  }
  if (nextBtn) {
    nextBtn.disabled = selectedFiles.length <= 1 || currentPreviewIndex >= selectedFiles.length - 1;
  }
}

// 添加切换预览图片的函数
function switchPreviewImage(index) {
  if (selectedFiles.length === 0) return;
  
  // 确保索引在有效范围内
  currentPreviewIndex = Math.max(0, Math.min(selectedFiles.length - 1, index));
  
  // 更新预览
  previewCurrentImage();
  
  // 更新计数器和按钮状态
  updatePreviewCounter();
}

// 添加预览当前图片的函数
async function previewCurrentImage() {
  if (selectedFiles.length === 0) return;
  
  const file = selectedFiles[currentPreviewIndex];
  if (!file) return;
  
  try {
    await processOne(file);
  } catch (err) {
    console.error(err);
    alert('预览失败');
  }
}

// 添加隐藏裁剪覆盖层的函数
function hideCropOverlay() {
  if (window.cropOverlay) {
    window.cropOverlay.style.display = 'none';
  }
}

// 添加显示裁剪覆盖层的函数
function showCropOverlay() {
  if (window.cropOverlay) {
    window.cropOverlay.style.display = 'block';
  }
}

// 清空：重置文件选择、列表与预览
clearBtn && clearBtn.addEventListener('click', () => {
  if(fileInput){ fileInput.value = ''; }
  if(fileList){ fileList.innerHTML = ''; }
  if(previewCanvas && ctx){ ctx.clearRect(0,0,previewCanvas.width, previewCanvas.height); previewCanvas.width = 0; previewCanvas.height = 0; }
  selectedFiles = [];
  cropRect = null;
  currentPreviewIndex = 0;  // 重置索引
  updatePreviewCounter();   // 更新计数器显示
  // 移除裁剪覆盖层
  removeCropOverlay();
});

// 初始化：重置所有设置到初始状态
resetBtn && resetBtn.addEventListener('click', () => {
  // 调用页面初始化函数，确保与刷新页面效果一致
  initializeApp();
  
  // 清空文件列表和预览
  if(fileInput){ fileInput.value = ''; }
  if(fileList){ fileList.innerHTML = ''; }
  if(previewCanvas && ctx){ ctx.clearRect(0,0,previewCanvas.width, previewCanvas.height); previewCanvas.width = 0; previewCanvas.height = 0; }
  selectedFiles = [];
  cropRect = null;
  currentPreviewIndex = 0;
  updatePreviewCounter();
  removeCropOverlay();
  
  // 手动触发change事件以确保界面更新
  if(toolSelect){ 
    toolSelect.dispatchEvent(new Event('change'));
  }
  if(unitSelect){ 
    unitSelect.dispatchEvent(new Event('change'));
  }
  
  // 更新界面显示
  updateControlVisibility();
  updateFormatIndicator();
});

downloadAllBtn && downloadAllBtn.addEventListener('click', async () => {
  const files = selectedFiles;
  if(files.length === 0){ alert('请先选择图片'); return; }
  // 在下载前隐藏裁剪覆盖层
  hideCropOverlay();
  for(const file of files){
    try{
      const blob = await processOne(file, false);
      makeDownload(outputFilenameForTool(file.name), blob);
      await new Promise(r => setTimeout(r, 150));
    }catch(err){ console.error(err); }
  }
  // 下载完成后移除裁剪覆盖层
  removeCropOverlay();
});

// 比例锁定（仅在输入其中一个维度时自动填充另一个）
lockRatio && lockRatio.addEventListener('change', ()=>{});
widthInput && widthInput.addEventListener('input', () => {
  if(!lockRatio || !lockRatio.checked) return;
  const first = selectedFiles[0];
  if(!first) return;
  
  loadImageBitmap(first).then(({width:w,height:h}) => {
    const val = Number(widthInput.value); 
    if(!val || isNaN(val)) return;
    const unit = unitSelect ? unitSelect.value : 'pixels';
    
    if (unit === 'pixels') {
      const newHeight = Math.round(val * (h/w));
      heightInput.value = newHeight;
    } else if (unit === 'percentage') {
      // 百分比模式下，宽度和高度使用相同的百分比值
      heightInput.value = val;
    } else {
      // 对于实际尺寸单位，需要转换后再计算
      const pixelVal = convertToPixels(val, unit, DEFAULT_DPI, w);
      const pixelHeight = Math.round(pixelVal * (h/w));
      heightInput.value = convertFromPixels(pixelHeight, unit, DEFAULT_DPI, h);
    }
    
    // 触发预览更新
    if (selectedFiles.length > 0) {
      previewCurrentImage();
    }
  }).catch((err)=>{
    console.error('Error in width input handler:', err);
  });
});

heightInput && heightInput.addEventListener('input', () => {
  if(!lockRatio || !lockRatio.checked) return;
  const first = selectedFiles[0];
  if(!first) return;
  
  loadImageBitmap(first).then(({width:w,height:h}) => {
    const val = Number(heightInput.value); 
    if(!val || isNaN(val)) return;
    const unit = unitSelect ? unitSelect.value : 'pixels';
    
    if (unit === 'pixels') {
      const newWidth = Math.round(val * (w/h));
      widthInput.value = newWidth;
    } else if (unit === 'percentage') {
      // 百分比模式下，宽度和高度使用相同的百分比值
      widthInput.value = val;
    } else {
      // 对于实际尺寸单位，需要转换后再计算
      const pixelVal = convertToPixels(val, unit, DEFAULT_DPI, h);
      const pixelWidth = Math.round(pixelVal * (w/h));
      widthInput.value = convertFromPixels(pixelWidth, unit, DEFAULT_DPI, w);
    }
    
    // 触发预览更新
    if (selectedFiles.length > 0) {
      previewCurrentImage();
    }
  }).catch((err)=>{
    console.error('Error in height input handler:', err);
  });
});

// 预览画布裁剪交互
toolSelect && previewCanvas && (function(){
  function getMousePos(e){
    const rect = previewCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (previewCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (previewCanvas.height / rect.height);
    return {x, y};
  }
  function clamp(val, min, max){ return Math.max(min, Math.min(max, val)); }
  
  // 添加裁剪覆盖层元素
  // 将cropOverlay声明为全局变量，以便其他函数可以访问
  window.cropOverlay = null;
  
  // 添加标志位，控制是否允许裁剪
  let isCropAllowed = true;
  
  // 存储原始图片尺寸，用于坐标转换
  let originalImageSize = { width: 0, height: 0 };
  
  function createCropOverlay() {
    if (!window.cropOverlay) {
      window.cropOverlay = document.createElement('div');
      window.cropOverlay.className = 'crop-overlay';
      // 将覆盖层添加到.preview-wrap容器中，而不是canvas的父节点
      document.querySelector('.preview-wrap').appendChild(window.cropOverlay);
    }
    return window.cropOverlay;
  }
  
  function redrawCropOverlay(){
    if(!cropRect || !previewCanvas) return;
    
    const overlay = createCropOverlay();
    const containerRect = document.querySelector('.preview-wrap').getBoundingClientRect();
    const canvasRect = previewCanvas.getBoundingClientRect();
    
    // 计算canvas在容器中的偏移
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;
    
    // 计算相对于预览画布的裁剪区域位置和尺寸
    const scaleX = canvasRect.width / previewCanvas.width;
    const scaleY = canvasRect.height / previewCanvas.height;
    
    overlay.style.position = 'absolute';
    overlay.style.left = offsetX + cropRect.x * scaleX + 'px';
    overlay.style.top = offsetY + cropRect.y * scaleY + 'px';
    overlay.style.width = cropRect.w * scaleX + 'px';
    overlay.style.height = cropRect.h * scaleY + 'px';
    overlay.style.border = '2px solid #5aa7ff';
    overlay.style.background = 'rgba(90, 167, 255, 0.15)';
    overlay.style.outline = '100vmax solid rgba(0, 0, 0, 0.35)';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '10';
  }
  
  function removeCropOverlay() {
    if (window.cropOverlay) {
      window.cropOverlay.remove();
      window.cropOverlay = null;
    }
  }
  
  // 添加重置裁剪状态的函数
  function resetCropState() {
    isCropAllowed = false;  // 默认只裁剪一次，所以重置后仍然禁用裁剪
    cropRect = null;
    originalImageSize = { width: 0, height: 0 };
    removeCropOverlay();
  }
  
  previewCanvas.addEventListener('mousedown', (e) => {
    // 检查是否允许裁剪
    if(toolSelect.value !== 'crop' || !isCropAllowed) return;
    isCropping = true;
    const {x,y} = getMousePos(e);
    cropStart = {x, y};
    cropRect = {x, y, w:0, h:0};
    redrawCropOverlay();
  });
  
  previewCanvas.addEventListener('mousemove', (e) => {
    // 检查是否允许裁剪
    if(!isCropping || toolSelect.value !== 'crop' || !isCropAllowed || !cropStart) return;
    const {x,y} = getMousePos(e);
    
    // 计算裁剪区域的宽度和高度
    let w = x - cropStart.x;
    let h = y - cropStart.y;
    
    // 确定裁剪区域的左上角坐标
    let cx = cropStart.x;
    let cy = cropStart.y;
    
    // 如果是向左上方向拖拽，调整坐标
    if(w < 0){ 
      cx = x;
      w = Math.abs(w);
    }
    if(h < 0){ 
      cy = y;
      h = Math.abs(h);
    }
    
    // 比例约束
    if(aspectSelect && aspectSelect.value !== 'free'){
      const [aw, ah] = aspectSelect.value.split(':').map(Number);
      const ratio = aw/ah;
      if(w / h > ratio){ 
        h = w / ratio; 
        // 如果是从下方拖拽，调整y坐标
        if(cropStart.y > y) {
          cy = cropStart.y - h;
        }
      } else { 
        w = h * ratio; 
        // 如果是从右方拖拽，调整x坐标
        if(cropStart.x > x) {
          cx = cropStart.x - w;
        }
      }
    }
    
    // 边界约束 - 确保裁剪区域在画布范围内
    cx = Math.max(0, Math.min(cx, previewCanvas.width));
    cy = Math.max(0, Math.min(cy, previewCanvas.height));
    w = Math.min(w, previewCanvas.width - cx);
    h = Math.min(h, previewCanvas.height - cy);
    
    // 确保最小尺寸为1
    w = Math.max(1, w);
    h = Math.max(1, h);
    
    cropRect = {x:cx, y:cy, w, h};
    redrawCropOverlay();
  });
  
  window.addEventListener('mouseup', () => { 
    if (isCropping) {
      isCropping = false;
      // 裁剪完成后，禁止再次裁剪
      isCropAllowed = false;
    }
  });
  
  // 当工具切换时，移除裁剪覆盖层并重置裁剪状态
  toolSelect.addEventListener('change', () => {
    if(toolSelect.value !== 'crop') {
      removeCropOverlay();
      cropRect = null;
      originalImageSize = { width: 0, height: 0 };
      // 重置裁剪状态
      resetCropState();
    } else {
      // 当切换到裁剪工具时，允许一次裁剪操作
      isCropAllowed = true;
      // 重置裁剪状态但保持允许裁剪
      cropRect = null;
      originalImageSize = { width: 0, height: 0 };
      removeCropOverlay();
    }
  });
  
  // 当窗口大小改变时，重新定位裁剪覆盖层
  window.addEventListener('resize', () => {
    if (cropRect && toolSelect.value === 'crop') {
      redrawCropOverlay();
    }
  });
  
  // 在清空按钮事件处理函数中重置裁剪状态
  clearBtn && clearBtn.addEventListener('click', () => {
    if(fileInput){ fileInput.value = ''; }
    if(fileList){ fileList.innerHTML = ''; }
    if(previewCanvas && ctx){ ctx.clearRect(0,0,previewCanvas.width, previewCanvas.height); previewCanvas.width = 0; previewCanvas.height = 0; }
    selectedFiles = [];
    cropRect = null;
    originalImageSize = { width: 0, height: 0 };
    currentPreviewIndex = 0;  // 重置索引
    updatePreviewCounter();   // 更新计数器显示
    // 移除裁剪覆盖层
    removeCropOverlay();
    // 清空后允许下一次裁剪操作
    isCropAllowed = true;
  });
  
  // 在预览按钮事件处理函数中重置裁剪状态
  previewBtn && previewBtn.addEventListener('click', async () => {
    const first = selectedFiles[0];
    if(!first){ alert('请先选择图片'); return; }
    currentPreviewIndex = 0;  // 重置到第一张图片
    updatePreviewCounter();   // 更新计数器
    try{ 
      // 如果当前是裁剪工具，允许一次裁剪操作
      if(toolSelect.value === 'crop') {
        isCropAllowed = true;
        // 重置裁剪状态但保持允许裁剪
        cropRect = null;
        originalImageSize = { width: 0, height: 0 };
        removeCropOverlay();
      } else {
        // 重置裁剪状态
        resetCropState();
      }
      await processOne(first, true); 
    }catch(err){ console.error(err); alert('预览失败'); }
  });
  
  // 暴露原始图片尺寸设置函数供processOne函数使用
  window.setOriginalImageSize = function(width, height) {
    originalImageSize = { width, height };
  };
  
  // 暴露裁剪坐标转换函数供processOne函数使用
  window.convertCropRectToOriginal = function(previewCropRect, previewCanvasWidth, previewCanvasHeight) {
    if (!originalImageSize.width || !originalImageSize.height) {
      return previewCropRect;
    }
    
    // 计算比例
    const scaleX = originalImageSize.width / previewCanvasWidth;
    const scaleY = originalImageSize.height / previewCanvasHeight;
    
    // 转换坐标
    return {
      x: Math.round(previewCropRect.x * scaleX),
      y: Math.round(previewCropRect.y * scaleY),
      w: Math.round(previewCropRect.w * scaleX),
      h: Math.round(previewCropRect.h * scaleY)
    };
  };
})();

// =====================
// ICO 构建（多 PNG 条目）
// =====================
function buildMultiPngIco(entries){
  const headerSize = 6;
  const entrySize = 16;
  const count = entries.length;
  let offset = headerSize + count * entrySize;
  const totalSize = offset + entries.reduce((s,e)=>s+e.data.length, 0);
  const buf = new ArrayBuffer(totalSize);
  const dv = new DataView(buf);
  let o = 0;
  // ICONDIR
  dv.setUint16(o, 0, true); o+=2;
  dv.setUint16(o, 1, true); o+=2;
  dv.setUint16(o, count, true); o+=2;
  // Entries
  let eo = headerSize;
  for(const e of entries){
    const w = e.size === 256 ? 0 : e.size;
    const h = e.size === 256 ? 0 : e.size;
    new Uint8Array(buf, eo, 1)[0] = w; eo+=1;
    new Uint8Array(buf, eo, 1)[0] = h; eo+=1;
    new Uint8Array(buf, eo, 1)[0] = 0; eo+=1; // color count
    new Uint8Array(buf, eo, 1)[0] = 0; eo+=1; // reserved
    dv.setUint16(eo, 1, true); eo+=2; // planes
    dv.setUint16(eo, 32, true); eo+=2; // bitcount
    dv.setUint32(eo, e.data.length, true); eo+=4; // size
    dv.setUint32(eo, offset, true); eo+=4; // offset
    // write data
    new Uint8Array(buf, offset, e.data.length).set(e.data);
    offset += e.data.length;
  }
  return new Blob([buf], {type: 'image/x-icon'});
}




