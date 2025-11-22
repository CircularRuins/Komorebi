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

# 检查 ImageMagick 是否安装
if ! command -v convert &> /dev/null; then
  echo "错误: 未找到 ImageMagick"
  echo "请安装 ImageMagick:"
  echo "  macOS: brew install imagemagick"
  echo "  Linux: sudo apt-get install imagemagick"
  echo "  Windows: https://imagemagick.org/script/download.php"
  exit 1
fi

echo "开始生成图标..."
echo "源文件: $SOURCE_ICON"
echo ""

# 生成主图标
convert "$SOURCE_ICON" -resize 512x512 build/icon.png
echo "✓ 生成 build/icon.png (512x512)"

# 生成 Linux 图标
mkdir -p build/icons
for size in 16 32 48 64 128 256 512; do
  convert "$SOURCE_ICON" -resize ${size}x${size} "build/icons/${size}x${size}.png"
  echo "✓ 生成 build/icons/${size}x${size}.png"
done

# 生成 macOS ICNS
echo ""
echo "生成 macOS ICNS 文件..."
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

if command -v iconutil &> /dev/null; then
  iconutil -c icns icon.iconset -o build/icon.icns
  echo "✓ 生成 build/icon.icns"
  rm -rf icon.iconset
else
  echo "⚠ 警告: 未找到 iconutil，无法生成 ICNS 文件"
  echo "   请使用在线工具转换: https://cloudconvert.com/png-to-icns"
  rm -rf icon.iconset
fi

# 生成 Windows ICO
echo ""
echo "生成 Windows ICO 文件..."
# 保持透明背景生成 ICO
convert "$SOURCE_ICON" \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 \
  build/icon.ico
echo "✓ 生成 build/icon.ico"

echo ""
echo "✅ 基础图标已生成完成！"
echo ""
echo "📝 下一步（可选）:"
echo "   如果需要发布到 Microsoft Store，请运行:"
echo "   ./scripts/generate-appx-icons.sh $SOURCE_ICON"
echo ""
echo "🧪 测试打包:"
echo "   npm run package-mac    # macOS"
echo "   npm run package-win-ci # Windows"
echo "   npm run package-linux  # Linux"

