# Windows 应用打包指南

## 📦 打包时的前置要求

这些是**在打包应用时**需要的工具（开发者需要）：

1. **Node.js** 和 **npm** 已安装
2. **Python 3** 已安装（用于构建 YouTube 转录脚本）
3. **PyInstaller** 已安装：`pip install pyinstaller`
4. 在 **Windows 系统**上执行打包（推荐）

## 💻 运行时的前置要求

这些是**最终用户在 Windows 上运行应用时**需要的：

✅ **无需任何额外安装！**

- ❌ **不需要**安装 Python
- ❌ **不需要**安装 Node.js
- ❌ **不需要**安装任何 Python 依赖

应用已经包含了所有必要的依赖：
- Python 脚本已通过 PyInstaller 打包成独立的 `.exe` 可执行文件（`--onefile` 选项）
- 所有 Python 依赖都已打包在可执行文件中
- Electron 运行时已包含在应用包中

用户只需要：
1. 下载并运行安装程序（`.exe` 文件）
2. 安装应用
3. 启动应用即可使用

## 打包步骤

### 方法 1：NSIS 安装包（推荐，标准 Windows 安装程序）

这是最常用的 Windows 应用分发方式，会生成一个 `.exe` 安装程序。

```bash
npm run package-win-nsis
```

**输出位置：** `bin/win-unpacked/` 或 `bin/win/x64/`

### 方法 2：AppX 包（Windows Store 应用）

用于发布到 Microsoft Store 的应用包格式。

```bash
npm run package-win
```

这会生成多个架构的 AppX 包（x64、ia32、arm64）。

### 方法 3：CI 打包（x64 和 ia32）

用于持续集成的打包方式，不发布到应用商店。

```bash
npm run package-win-ci
```

## 详细流程说明

所有打包脚本都会自动执行以下步骤：

1. **构建 Python 脚本**：使用 `build-python.ps1` 构建 Windows 可执行文件
   - 输出：`python-scripts/dist/get_youtube_transcript.exe`

2. **构建前端代码**：使用 webpack 打包前端资源
   - 输出：`dist/` 目录

3. **验证 Python 构建**：检查可执行文件是否存在

4. **打包 Electron 应用**：使用 electron-builder 创建 Windows 安装包

## 📤 发布文件说明

打包完成后，在 `bin/darwin/x64/`（如果在 macOS 上打包）或 `bin/win/x64/`（如果在 Windows 上打包）目录下会生成以下文件：

### ✅ 主要发布文件（必需）

**`Komorebi Setup 1.0.0.exe`**（约 104MB）
- **NSIS 安装程序**，这是**主要的分发文件**
- 用户下载后双击即可安装
- 支持选择安装目录、创建开始菜单快捷方式等
- **推荐作为主要下载选项**

### 📦 可选发布文件

**`Komorebi-1.0.0-win.zip`**（约 137MB）
- **便携版**，解压即可使用，无需安装
- 适合不想安装或需要便携使用的用户
- 可作为备选下载选项

### 🔄 自动更新相关文件（如果支持自动更新）

**`latest.yml`**
- 自动更新配置文件
- 如果应用支持自动更新，需要将此文件上传到更新服务器
- 应用会检查此文件来发现新版本

**`Komorebi Setup 1.0.0.exe.blockmap`**
- 用于增量更新，减少下载量
- 如果支持自动更新，建议一并上传

### ❌ 不需要发布的文件

- **`win-unpacked/`** 目录：这是未打包的中间产物，不需要发布

## 打包配置

Windows 打包配置在 `electron-builder.yml` 中：

- **目标格式**：NSIS 安装程序和 ZIP 压缩包
- **图标**：`build/icon.ico`
- **安装选项**：
  - 允许用户选择安装目录
  - 卸载时删除应用数据
  - 支持每用户或每机器安装

## 在 macOS/Linux 上交叉编译 Windows 应用

虽然可以在 macOS 上使用 electron-builder 交叉编译 Windows 应用，但需要：

1. 安装 Wine（用于签名等操作）
2. 手动构建 Windows 版本的 Python 可执行文件

**推荐做法**：在 Windows 系统上直接打包，或使用 CI/CD 服务（如 GitHub Actions）在 Windows 环境中构建。

## 故障排除

### Python 脚本构建失败

确保：
- Python 3 已安装并可用
- PyInstaller 已安装：`pip install pyinstaller`
- 依赖已安装：`pip install -r python-scripts/requirements.txt`

### 打包失败

检查：
- `build/icon.ico` 文件是否存在
- `dist/` 目录是否包含所有必要的文件
- Node.js 和 npm 版本是否兼容

### 缺少 Python 可执行文件

如果 `python-scripts/dist/get_youtube_transcript.exe` 不存在，手动运行：

```powershell
cd python-scripts
powershell -ExecutionPolicy Bypass -File build-python.ps1
```

