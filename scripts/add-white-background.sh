#!/bin/bash
# add-white-background.sh - 为所有图标添加白色背景（保持圆角矩形形状）

# 检查 ImageMagick 是否安装
if ! command -v convert &> /dev/null; then
  echo "错误: 未找到 ImageMagick"
  echo "请安装 ImageMagick:"
  echo "  macOS: brew install imagemagick"
  echo "  Linux: sudo apt-get install imagemagick"
  echo "  Windows: https://imagemagick.org/script/download.php"
  exit 1
fi

# 函数：为图标添加白色背景和圆角效果
# macOS 应用图标使用约 22.37% 的圆角半径
add_white_background_rounded() {
  local input_file="$1"
  local output_file="${2:-$input_file}"
  
  # 获取图片尺寸（宽度）
  local width=$(identify -format "%w" "$input_file" 2>/dev/null)
  
  if [ -z "$width" ]; then
    echo "⚠ 警告: 无法获取 $input_file 的尺寸"
    return 1
  fi
  
  # 计算圆角半径（macOS 标准：约 22.37%）
  local radius=$(echo "scale=0; $width * 0.2237" | bc)
  
  # 创建临时文件
  local temp_file="/tmp/icon_temp_$$.png"
  local mask_file="/tmp/icon_mask_$$.png"
  
  # 创建圆角矩形蒙版
  convert -size ${width}x${width} xc:none \
    -draw "roundrectangle 0,0 $((width-1)),$((width-1)) $radius,$radius" \
    "$mask_file"
  
  # 创建白色背景
  convert -size ${width}x${width} xc:white "$temp_file"
  
  # 将原始图标合成到白色背景上
  convert "$temp_file" "$input_file" \
    -compose over \
    -composite \
    "$mask_file" \
    -compose DstIn \
    -composite \
    "$output_file"
  
  # 清理临时文件
  rm -f "$temp_file" "$mask_file"
}

echo "开始为图标添加白色背景（保持圆角矩形形状）..."
echo ""

# 处理主图标 build/icon.png
if [ -f "build/icon.png" ]; then
  add_white_background_rounded "build/icon.png" "build/icon.png"
  echo "✓ 处理 build/icon.png"
else
  echo "⚠ 警告: build/icon.png 不存在"
fi

# 处理 build/icons/ 目录下的所有 PNG 文件
if [ -d "build/icons" ]; then
  for icon_file in build/icons/*.png; do
    if [ -f "$icon_file" ]; then
      add_white_background_rounded "$icon_file" "$icon_file"
      echo "✓ 处理 $icon_file"
    fi
  done
else
  echo "⚠ 警告: build/icons 目录不存在"
fi

# 处理 macOS ICNS 文件
if [ -f "build/icon.png" ]; then
  echo ""
  echo "重新生成 macOS ICNS 文件（使用带白色背景的 icon.png）..."
  
  # 检查是否有 iconutil 命令
  if command -v iconutil &> /dev/null; then
    # 创建临时 iconset 目录（必须以 .iconset 结尾）
    TEMP_ICONSET="icon.iconset"
    rm -rf "$TEMP_ICONSET"
    mkdir -p "$TEMP_ICONSET"
    
    # 从已处理的 icon.png（带白色背景）生成所有尺寸的图标
    convert "build/icon.png" -resize 16x16 "$TEMP_ICONSET/icon_16x16.png"
    convert "build/icon.png" -resize 32x32 "$TEMP_ICONSET/icon_16x16@2x.png"
    convert "build/icon.png" -resize 32x32 "$TEMP_ICONSET/icon_32x32.png"
    convert "build/icon.png" -resize 64x64 "$TEMP_ICONSET/icon_32x32@2x.png"
    convert "build/icon.png" -resize 128x128 "$TEMP_ICONSET/icon_128x128.png"
    convert "build/icon.png" -resize 256x256 "$TEMP_ICONSET/icon_128x128@2x.png"
    convert "build/icon.png" -resize 256x256 "$TEMP_ICONSET/icon_256x256.png"
    convert "build/icon.png" -resize 512x512 "$TEMP_ICONSET/icon_256x256@2x.png"
    convert "build/icon.png" -resize 512x512 "$TEMP_ICONSET/icon_512x512.png"
    convert "build/icon.png" -resize 1024x1024 "$TEMP_ICONSET/icon_512x512@2x.png"
    
    # 确保所有图标都有白色背景（保持圆角矩形形状）
    for icon_file in "$TEMP_ICONSET"/*.png; do
      if [ -f "$icon_file" ]; then
        add_white_background_rounded "$icon_file" "$icon_file"
      fi
    done
    
    # 打包为 ICNS
    iconutil -c icns "$TEMP_ICONSET" -o "build/icon.icns"
    echo "✓ 重新生成 build/icon.icns（带白色背景）"
    
    # 清理临时目录
    rm -rf "$TEMP_ICONSET"
  else
    echo "⚠ 警告: 未找到 iconutil，无法处理 ICNS 文件"
    echo "   请手动处理或使用在线工具: https://cloudconvert.com/png-to-icns"
  fi
else
  echo "⚠ 警告: build/icon.png 不存在，无法生成 ICNS 文件"
fi

# 处理 Windows ICO 文件
if [ -f "build/icon.png" ]; then
  echo ""
  echo "重新生成 Windows ICO 文件..."
  convert "build/icon.png" \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 64x64 \) \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 256x256 \) \
    -delete 0 \
    -alpha off \
    -colors 256 \
    "build/icon.ico"
  echo "✓ 重新生成 build/icon.ico"
else
  echo "⚠ 警告: build/icon.png 不存在，无法生成 ICO 文件"
fi

echo ""
echo "✅ 所有图标已添加白色背景！"

