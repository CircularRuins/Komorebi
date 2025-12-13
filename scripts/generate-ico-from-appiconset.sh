#!/bin/bash
# generate-ico-from-appiconset.sh - 从 AppIcon.appiconset 生成 Windows 图标文件

APPICONSET_DIR="build/AppIcon.appiconset"
OUTPUT_ICO="build/icon.ico"

# 检查 AppIcon.appiconset 目录是否存在
if [ ! -d "$APPICONSET_DIR" ]; then
  echo "错误: AppIcon.appiconset 目录不存在: $APPICONSET_DIR"
  exit 1
fi

# 优先使用 mac512pt2x.png (1024x1024)，如果没有则使用 mac512pt1x.png (512x512)
SOURCE_ICON=""
if [ -f "$APPICONSET_DIR/mac512pt2x.png" ]; then
  SOURCE_ICON="$APPICONSET_DIR/mac512pt2x.png"
  echo "使用源文件: $SOURCE_ICON (1024x1024)"
elif [ -f "$APPICONSET_DIR/mac512pt1x.png" ]; then
  SOURCE_ICON="$APPICONSET_DIR/mac512pt1x.png"
  echo "使用源文件: $SOURCE_ICON (512x512)"
elif [ -f "$APPICONSET_DIR/mac256pt2x.png" ]; then
  SOURCE_ICON="$APPICONSET_DIR/mac256pt2x.png"
  echo "使用源文件: $SOURCE_ICON (512x512)"
else
  echo "错误: 在 $APPICONSET_DIR 中未找到合适的源图标文件"
  echo "请确保存在以下文件之一:"
  echo "  - mac512pt2x.png (1024x1024)"
  echo "  - mac512pt1x.png (512x512)"
  echo "  - mac256pt2x.png (512x512)"
  exit 1
fi

# 检查 ImageMagick 是否安装
if ! command -v convert &> /dev/null; then
  echo "错误: 未找到 ImageMagick"
  echo "请安装 ImageMagick:"
  echo "  macOS: brew install imagemagick"
  echo "  Linux: sudo apt-get install imagemagick"
  echo "  Windows: https://imagemagick.org/script/download.php"
  exit 1
fi

echo "生成 Windows ICO 文件..."
echo "输出文件: $OUTPUT_ICO"
echo ""

# 创建临时目录
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# 定义要生成的尺寸（Windows ICO 标准尺寸）
SIZES=(16 32 48 64 128 256)

# 为每个尺寸生成图标
for size in "${SIZES[@]}"; do
  temp_file="$TEMP_DIR/icon_${size}x${size}.png"
  
  # 调整大小（优先使用 magick 命令，如果不存在则使用 convert）
  if command -v magick &> /dev/null; then
    magick "$SOURCE_ICON" -resize ${size}x${size} "$temp_file"
  else
    convert "$SOURCE_ICON" -resize ${size}x${size} "$temp_file"
  fi
  
  echo "✓ 生成 ${size}x${size}"
done

# 将所有尺寸合并为 ICO 文件
echo ""
echo "合并为 ICO 文件..."
if command -v magick &> /dev/null; then
  magick "$TEMP_DIR"/icon_*.png "$OUTPUT_ICO"
else
  convert "$TEMP_DIR"/icon_*.png "$OUTPUT_ICO"
fi

echo ""
echo "✅ 成功生成 Windows 图标文件: $OUTPUT_ICO"
echo "   包含尺寸: ${SIZES[*]}"
echo "   源文件: $SOURCE_ICON"

