#!/bin/bash
# 下载 YouTube favicon 图标到项目中

ICON_URL="https://www.youtube.com/s/desktop/181af002/img/favicon_32x32.png"
ICON_PATH="dist/icons/youtube-favicon-32x32.png"

echo "正在下载 YouTube favicon 图标..."
curl -L -o "$ICON_PATH" "$ICON_URL"

if [ $? -eq 0 ]; then
    echo "✓ 图标已下载到: $ICON_PATH"
    file "$ICON_PATH"
else
    echo "✗ 下载失败，请检查网络连接"
    exit 1
fi

