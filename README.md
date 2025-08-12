# IntroJoiner (Windows 桌面版)
离线批量拼接“片头 + 正片”的桌面工具。内置 ffmpeg 二进制（通过 `ffmpeg-static`），无需用户环境。

## 快速打包（生成 .exe 安装包）
1. 安装 Node.js 18+ 与 pnpm 或 npm
2. 在本项目目录运行：
   ```bash
   npm install
   npm run dist
   ```
3. 生成的安装包在 `dist/` 下，发给同事即可双击安装。

## 开发调试
```bash
npm install
npm start
```

## 功能
- 选择 1 个片头 + 多个正片（mp4）
- 统一分辨率/帧率（预设：1080×1920、1920×1080、1080×1080，或保持原参数）
- 并发处理（可设置并行度）
- 选择输出目录
- 日志与进度（单文件进度 + 总体进度）
