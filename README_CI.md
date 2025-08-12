# 通过 GitHub Actions 自动打包 Windows EXE

## 使用方法
1. 新建一个 GitHub 仓库，把这个项目的所有文件推上去（包含 `.github/workflows/build.yml`）。
2. 打开仓库的 **Actions** 标签页，启用 Workflows。
3. 在 Actions 里点击 **Run workflow**（workflow_dispatch），或给 `main` 分支推送代码/打 `v*` 标签。
4. 等待构建完成后，在 **Actions** 页面里下载 artifact：`IntroJoiner-setup`（里面就是 `IntroJoiner-*.exe` 安装包）。

> 需要代码签名的话，可在 `electron-builder` 文档指导下添加证书并在仓库 Secrets 中配置；不签名也能用，但 Windows 可能显示 SmartScreen 警告。

## 本地开发
```bash
npm ci
npm start
```
