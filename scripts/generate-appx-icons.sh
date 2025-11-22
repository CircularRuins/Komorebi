#!/bin/bash
# generate-appx-icons.sh - 生成 Windows Store (APPX) 所需的所有图标

if [ -z "$1" ]; then
  echo "用法: ./scripts/generate-appx-icons.sh <源图片路径>"
  echo "示例: ./scripts/generate-appx-icons.sh ~/Downloads/new-icon-1024x1024.png"
  exit 1
fi

SOURCE_ICON="$1"

if [ ! -f "$SOURCE_ICON" ]; then
  echo "错误: 文件不存在: $SOURCE_ICON"
  exit 1
fi

# 检查 ImageMagick 是否安装
if ! command -v convert &> /dev/null; then
  echo "错误: 未找到 ImageMagick"
  echo "请安装 ImageMagick:"
  echo "  macOS: brew install imagemagick"
  echo "  Linux: sudo apt-get install imagemagick"
  exit 1
fi

OUTPUT_DIR="build/appx"
mkdir -p "$OUTPUT_DIR"

echo "生成 Windows Store (APPX) 图标..."
echo "源文件: $SOURCE_ICON"
echo "输出目录: $OUTPUT_DIR"
echo ""

# 基础尺寸和缩放比例
SCALES=(100 125 150 200 400)

# Square44x44Logo (44x44 基础尺寸)
echo "生成 Square44x44Logo..."
for scale in "${SCALES[@]}"; do
  size=$((44 * scale / 100))
  # 按比例缩放，保持宽高比，居中放置在正方形画布上
  convert "$SOURCE_ICON" -resize ${size}x${size} -gravity center -background transparent -extent ${size}x${size} "${OUTPUT_DIR}/Square44x44Logo.scale-${scale}.png"
done

# Square44x44Logo targetsize
for size in 16 24 32 48 256; do
  # 按比例缩放，保持宽高比，居中放置在正方形画布上
  convert "$SOURCE_ICON" -resize ${size}x${size} -gravity center -background transparent -extent ${size}x${size} "${OUTPUT_DIR}/Square44x44Logo.targetsize-${size}.png"
  convert "$SOURCE_ICON" -resize ${size}x${size} -gravity center -background transparent -extent ${size}x${size} "${OUTPUT_DIR}/Square44x44Logo.altform-unplated_targetsize-${size}.png"
  convert "$SOURCE_ICON" -resize ${size}x${size} -gravity center -background transparent -extent ${size}x${size} "${OUTPUT_DIR}/Square44x44Logo.altform-lightunplated_targetsize-${size}.png"
done
echo "✓ Square44x44Logo 完成"

# Square150x150Logo (150x150 基础尺寸)
echo "生成 Square150x150Logo..."
for scale in "${SCALES[@]}"; do
  size=$((150 * scale / 100))
  # 按比例缩放，保持宽高比，居中放置在正方形画布上
  convert "$SOURCE_ICON" -resize ${size}x${size} -gravity center -background transparent -extent ${size}x${size} "${OUTPUT_DIR}/Square150x150Logo.scale-${scale}.png"
done
echo "✓ Square150x150Logo 完成"

# SmallTile (70x70 基础尺寸)
echo "生成 SmallTile..."
for scale in "${SCALES[@]}"; do
  size=$((70 * scale / 100))
  # 按比例缩放，保持宽高比，居中放置在正方形画布上
  convert "$SOURCE_ICON" -resize ${size}x${size} -gravity center -background transparent -extent ${size}x${size} "${OUTPUT_DIR}/SmallTile.scale-${scale}.png"
done
echo "✓ SmallTile 完成"

# Wide310x150Logo (310x150)
echo "生成 Wide310x150Logo..."
for scale in "${SCALES[@]}"; do
  width=$((310 * scale / 100))
  height=$((150 * scale / 100))
  # 按比例缩放，保持宽高比，居中放置在矩形画布上
  convert "$SOURCE_ICON" -resize ${width}x${height} -gravity center -background transparent -extent ${width}x${height} "${OUTPUT_DIR}/Wide310x150Logo.scale-${scale}.png"
done
echo "✓ Wide310x150Logo 完成"

# StoreLogo (50x50 基础尺寸)
echo "生成 StoreLogo..."
for scale in "${SCALES[@]}"; do
  size=$((50 * scale / 100))
  # 按比例缩放，保持宽高比，居中放置在正方形画布上
  convert "$SOURCE_ICON" -resize ${size}x${size} -gravity center -background transparent -extent ${size}x${size} "${OUTPUT_DIR}/StoreLogo.scale-${scale}.png"
done
echo "✓ StoreLogo 完成"

# SplashScreen (620x300)
echo "生成 SplashScreen..."
for scale in "${SCALES[@]}"; do
  width=$((620 * scale / 100))
  height=$((300 * scale / 100))
  # 按比例缩放，保持宽高比，居中放置在矩形画布上
  convert "$SOURCE_ICON" -resize ${width}x${height} -gravity center -background transparent -extent ${width}x${height} "${OUTPUT_DIR}/SplashScreen.scale-${scale}.png"
done
echo "✓ SplashScreen 完成"

echo ""
echo "✅ 所有 APPX 图标已生成到 ${OUTPUT_DIR}/"
echo "   共生成 $(ls -1 ${OUTPUT_DIR}/*.png | wc -l) 个文件"

