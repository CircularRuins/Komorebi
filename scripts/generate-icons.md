# 图标生成和替换指南

## 准备工作

### 1. 准备源图片
- 建议尺寸：**1024x1024 像素**（正方形）
- 格式：PNG（透明背景）或 JPG
- 确保图片清晰，边缘平滑

### 2. 安装工具

#### macOS 用户
```bash
# ImageMagick（用于批量生成多尺寸图片）
brew install imagemagick

# 或使用在线工具（见下方）
```

#### Windows 用户
- 下载 ImageMagick：https://imagemagick.org/script/download.php
- 或使用在线工具

## 生成图标文件

### 方法 1：使用 electron-icon-maker（推荐，自动化）

```bash
# 安装 electron-icon-maker
npm install -g electron-icon-maker

# 生成所有图标（从 1024x1024 的 icon.png）
electron-icon-maker --input=./your-icon-1024x1024.png --output=./build
```

这会自动生成：
- `build/icon.icns` (macOS)
- `build/icon.ico` (Windows)
- `build/icons/` 目录下的所有尺寸

### 方法 2：手动生成（更精确控制）

#### 步骤 1：生成基础 PNG
```bash
# 生成主图标（512x512）
convert your-icon.png -resize 512x512 build/icon.png

# 生成 Linux 多尺寸图标
convert your-icon.png -resize 16x16 build/icons/16x16.png
convert your-icon.png -resize 32x32 build/icons/32x32.png
convert your-icon.png -resize 48x48 build/icons/48x48.png
convert your-icon.png -resize 64x64 build/icons/64x64.png
convert your-icon.png -resize 128x128 build/icons/128x128.png
convert your-icon.png -resize 256x256 build/icons/256x256.png
convert your-icon.png -resize 512x512 build/icons/512x512.png
```

#### 步骤 2：生成 macOS ICNS 文件

```bash
# 创建 iconset 目录
mkdir -p icon.iconset

# 生成不同尺寸的 PNG
convert your-icon.png -resize 16x16 icon.iconset/icon_16x16.png
convert your-icon.png -resize 32x32 icon.iconset/icon_16x16@2x.png
convert your-icon.png -resize 32x32 icon.iconset/icon_32x32.png
convert your-icon.png -resize 64x64 icon.iconset/icon_32x32@2x.png
convert your-icon.png -resize 128x128 icon.iconset/icon_128x128.png
convert your-icon.png -resize 256x256 icon.iconset/icon_128x128@2x.png
convert your-icon.png -resize 256x256 icon.iconset/icon_256x256.png
convert your-icon.png -resize 512x512 icon.iconset/icon_256x256@2x.png
convert your-icon.png -resize 512x512 icon.iconset/icon_512x512.png
convert your-icon.png -resize 1024x1024 icon.iconset/icon_512x512@2x.png

# 转换为 ICNS
iconutil -c icns icon.iconset -o build/icon.icns

# 清理临时文件
rm -rf icon.iconset
```

#### 步骤 3：生成 Windows ICO 文件

```bash
# 使用 ImageMagick 生成 ICO（包含多个尺寸）
convert your-icon.png \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 \
  -alpha off \
  -colors 256 \
  build/icon.ico
```

或者使用在线工具：
- https://convertio.co/zh/png-ico/
- https://www.icoconverter.com/

#### 步骤 4：生成 Windows Store (APPX) 图标

Windows Store 需要大量不同尺寸的图标。可以使用以下脚本批量生成：

```bash
#!/bin/bash
# generate-appx-icons.sh

SOURCE_ICON="your-icon.png"
OUTPUT_DIR="build/appx"

# 基础尺寸
BASE_SIZES=(44 150 310 70)
SCALES=(100 125 150 200 400)

# Square44x44Logo (44x44 基础尺寸)
for scale in "${SCALES[@]}"; do
  size=$((44 * scale / 100))
  convert "$SOURCE_ICON" -resize ${size}x${size} "${OUTPUT_DIR}/Square44x44Logo.scale-${scale}.png"
done

# Square44x44Logo targetsize
for size in 16 24 32 48 256; do
  convert "$SOURCE_ICON" -resize ${size}x${size} "${OUTPUT_DIR}/Square44x44Logo.targetsize-${size}.png"
  convert "$SOURCE_ICON" -resize ${size}x${size} "${OUTPUT_DIR}/Square44x44Logo.altform-unplated_targetsize-${size}.png"
  convert "$SOURCE_ICON" -resize ${size}x${size} "${OUTPUT_DIR}/Square44x44Logo.altform-lightunplated_targetsize-${size}.png"
done

# Square150x150Logo (150x150 基础尺寸)
for scale in "${SCALES[@]}"; do
  size=$((150 * scale / 100))
  convert "$SOURCE_ICON" -resize ${size}x${size} "${OUTPUT_DIR}/Square150x150Logo.scale-${scale}.png"
done

# SmallTile (70x70 基础尺寸)
for scale in "${SCALES[@]}"; do
  size=$((70 * scale / 100))
  convert "$SOURCE_ICON" -resize ${size}x${size} "${OUTPUT_DIR}/SmallTile.scale-${scale}.png"
done

# Wide310x150Logo (310x150)
for scale in "${SCALES[@]}"; do
  width=$((310 * scale / 100))
  height=$((150 * scale / 100))
  convert "$SOURCE_ICON" -resize ${width}x${height} "${OUTPUT_DIR}/Wide310x150Logo.scale-${scale}.png"
done

# StoreLogo
for scale in "${SCALES[@]}"; do
  size=$((50 * scale / 100))
  convert "$SOURCE_ICON" -resize ${size}x${size} "${OUTPUT_DIR}/StoreLogo.scale-${scale}.png"
done

# SplashScreen (620x300)
for scale in "${SCALES[@]}"; do
  width=$((620 * scale / 100))
  height=$((300 * scale / 100))
  convert "$SOURCE_ICON" -resize ${width}x${height} -gravity center -extent ${width}x${height} "${OUTPUT_DIR}/SplashScreen.scale-${scale}.png"
done

echo "所有 APPX 图标已生成到 ${OUTPUT_DIR}/"
```

### 方法 3：使用在线工具（最简单）

1. **PNG 转 ICO**：
   - https://convertio.co/zh/png-ico/
   - https://www.icoconverter.com/

2. **PNG 转 ICNS**：
   - https://cloudconvert.com/png-to-icns
   - https://convertio.co/zh/png-icns/

3. **批量生成多尺寸 PNG**：
   - https://www.iloveimg.com/resize-image
   - https://www.resizepixel.com/

## 需要替换的文件清单

### 必须替换的文件：

1. **`build/icon.png`** - 主图标（512x512 或更高）
2. **`build/icon.ico`** - Windows 图标
3. **`build/icon.icns`** - macOS 图标
4. **`build/icons/`** 目录下的所有 PNG：
   - 16x16.png
   - 32x32.png
   - 48x48.png
   - 64x64.png
   - 128x128.png
   - 256x256.png
   - 512x512.png

### Windows Store (APPX) 图标（如果发布到 Microsoft Store）：

5. **`build/appx/`** 目录下的所有 PNG 文件（约 50+ 个文件）

## 快速替换脚本

创建一个自动化脚本 `scripts/replace-icons.sh`：

```bash
#!/bin/bash
# replace-icons.sh - 从源图片生成并替换所有图标

if [ -z "$1" ]; then
  echo "用法: ./scripts/replace-icons.sh <源图片路径>"
  echo "示例: ./scripts/replace-icons.sh ~/Downloads/new-icon-1024x1024.png"
  exit 1
fi

SOURCE_ICON="$1"

if [ ! -f "$SOURCE_ICON" ]; then
  echo "错误: 文件不存在: $SOURCE_ICON"
  exit 1
fi

echo "开始生成图标..."

# 生成主图标
convert "$SOURCE_ICON" -resize 512x512 build/icon.png
echo "✓ 生成 build/icon.png"

# 生成 Linux 图标
mkdir -p build/icons
for size in 16 32 48 64 128 256 512; do
  convert "$SOURCE_ICON" -resize ${size}x${size} "build/icons/${size}x${size}.png"
done
echo "✓ 生成 Linux 图标"

# 生成 macOS ICNS
mkdir -p icon.iconset
convert "$SOURCE_ICON" -resize 16x16 icon.iconset/icon_16x16.png
convert "$SOURCE_ICON" -resize 32x32 icon.iconset/icon_16x16@2x.png
convert "$SOURCE_ICON" -resize 32x32 icon.iconset/icon_32x32.png
convert "$SOURCE_ICON" -resize 64x64 icon.iconset/icon_32x32@2x.png
convert "$SOURCE_ICON" -resize 128x128 icon.iconset/icon_128x128.png
convert "$SOURCE_ICON" -resize 256x256 icon.iconset/icon_128x128@2x.png
convert "$SOURCE_ICON" -resize 256x256 icon.iconset/icon_256x256.png
convert "$SOURCE_ICON" -resize 512x512 icon.iconset/icon_256x256@2x.png
convert "$SOURCE_ICON" -resize 512x512 icon.iconset/icon_512x512.png
convert "$SOURCE_ICON" -resize 1024x1024 icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o build/icon.icns
rm -rf icon.iconset
echo "✓ 生成 build/icon.icns"

# 生成 Windows ICO
convert "$SOURCE_ICON" \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 \
  -alpha off \
  -colors 256 \
  build/icon.ico
echo "✓ 生成 build/icon.ico"

echo ""
echo "✅ 所有图标已生成！"
echo ""
echo "注意: Windows Store (APPX) 图标需要单独生成，"
echo "      如果不需要发布到 Microsoft Store，可以跳过。"
```

使用方法：
```bash
chmod +x scripts/replace-icons.sh
./scripts/replace-icons.sh path/to/your-icon-1024x1024.png
```

## 验证

替换完成后，测试打包：

```bash
# macOS
npm run package-mac

# Windows
npm run package-win-ci

# Linux
npm run package-linux
```

## 注意事项

1. **图片质量**：源图片建议 1024x1024 或更高，确保缩放后清晰
2. **透明背景**：如果使用 PNG，保持透明背景
3. **圆角处理**：某些平台（如 macOS）会自动添加圆角，无需手动处理
4. **文件命名**：保持文件名不变，只替换文件内容
5. **备份**：替换前建议备份原有图标文件

## 推荐工具总结

- **ImageMagick**：命令行批量处理（最灵活）
- **electron-icon-maker**：npm 包，自动化生成（最方便）
- **在线工具**：适合偶尔使用，无需安装


