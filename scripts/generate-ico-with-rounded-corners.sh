#!/bin/bash
# generate-ico-with-rounded-corners.sh - 从 icon.png 生成带圆角的 icon.ico

SOURCE_ICON="build/icon.png"
OUTPUT_ICO="build/icon.ico"

# 检查源文件是否存在
if [ ! -f "$SOURCE_ICON" ]; then
  echo "错误: 源文件不存在: $SOURCE_ICON"
  echo "请确保 build/icon.png 存在"
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

echo "生成带圆角的 Windows ICO 文件..."
echo "源文件: $SOURCE_ICON"
echo "输出文件: $OUTPUT_ICO"
echo ""

# 圆角半径百分比（符合 Windows 设计规范，约 10%）
CORNER_RADIUS_PERCENT=10

# 创建临时目录
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# 定义要生成的尺寸
SIZES=(16 32 48 64 128 256)

# 为每个尺寸生成带圆角的图标
for size in "${SIZES[@]}"; do
  # 计算圆角半径（约 10%）
  radius=$(awk "BEGIN {printf \"%.0f\", $size * $CORNER_RADIUS_PERCENT / 100}")
  # 确保最小半径为 1px
  if [ "$radius" -lt 1 ]; then
    radius=1
  fi
  
  temp_file="$TEMP_DIR/icon_${size}x${size}.png"
  
  # 先调整大小
  convert "$SOURCE_ICON" -resize ${size}x${size} "$temp_file"
  
  # 创建圆角遮罩并应用
  # 方法：创建一个圆角矩形遮罩（白色圆角矩形），然后作为透明度通道应用
  convert "$temp_file" \
    \( -size ${size}x${size} xc:none \
       -fill white -draw "roundrectangle 0,0 $((size-1)),$((size-1)) $radius,$radius" \
    \) \
    -alpha off -compose CopyOpacity -composite \
    "$temp_file"
  
  echo "✓ 生成 ${size}x${size} (圆角半径: ${radius}px)"
done

# 将所有尺寸合并为 ICO 文件
echo ""
echo "合并为 ICO 文件..."
convert "$TEMP_DIR"/icon_*.png "$OUTPUT_ICO"

echo ""
echo "✅ 成功生成带圆角的 build/icon.ico"
echo "   包含尺寸: ${SIZES[*]}"
echo "   圆角半径: ${CORNER_RADIUS_PERCENT}%"
