<style>
.lang-switcher {
  text-align: right;
  margin-bottom: 20px;
}
.lang-switcher input[type="radio"] {
  display: none;
}
.lang-switcher label {
  cursor: pointer;
  padding: 5px 10px;
  margin: 0 5px;
  color: #0366d6;
  text-decoration: none;
}
.lang-switcher label:hover {
  text-decoration: underline;
}
.lang-switcher input[type="radio"]:checked + label {
  font-weight: bold;
  color: #24292e;
  text-decoration: none;
}
.lang-zh {
  display: none;
}
#lang-zh:checked ~ .lang-en {
  display: none;
}
#lang-zh:checked ~ .lang-zh {
  display: block;
}
#lang-en:checked ~ .lang-en {
  display: block;
}
#lang-en:checked ~ .lang-zh {
  display: none;
}
</style>

<input type="radio" id="lang-en" name="lang" checked>
<input type="radio" id="lang-zh" name="lang">

<div class="lang-switcher">
  <label for="lang-en">English</label>
  <label for="lang-zh">中文</label>
</div>

<div class="lang-en">

<p align="center">
  <img width="120" height="120" src="https://github.com/CircularRuins/Komorebi/raw/master/build/icon.png">
</p>
<h3 align="center">Komorebi</h3>
<p align="center">A modern desktop RSS reader</p>
<p align="center">
  <img src="https://img.shields.io/github/v/release/CircularRuins/Komorebi?label=version" />
  <img src="https://img.shields.io/github/downloads/CircularRuins/Komorebi/total" />
  <img src="https://github.com/CircularRuins/Komorebi/workflows/CI%2FCD%20Release/badge.svg" />
</p>
<hr />

## Download

You can [get Komorebi from GitHub releases](https://github.com/CircularRuins/Komorebi/releases). We support Windows，macOS and Linux. 

## Features

<p align="center">
  <img src="https://github.com/CircularRuins/Komorebi/raw/master/docs/imgs/screenshot.jpg">
</p>

- A modern UI inspired by Fluent Design System with full dark mode support.
- Read locally or sync with self-hosted services compatible with Fever or Google Reader API.
- Sync with RSS Services including Inoreader, Feedbin, The Old Reader, BazQux Reader, and more.
- Importing or exporting OPML files, full application data backup & restoration.
- Read the full content with the built-in article view or load webpages by default.
- Search for articles with regular expressions or filter by read status.
- Organize your subscriptions with folder-like groupings.
- Single-key [keyboard shortcuts](https://github.com/CircularRuins/Komorebi/wiki/Support#keyboard-shortcuts).
- Hide, mark as read, or star articles automatically as they arrive with regular expression rules.
- Fetch articles in the background and send push notifications.

Support for other RSS services are [under fundraising](https://github.com/CircularRuins/Komorebi/issues/23). 

## Development

### Contribute

Help make Komorebi better by reporting bugs or opening feature requests through [GitHub issues](https://github.com/CircularRuins/Komorebi/issues). 

You can also help internationalize the app by providing [translations into additional languages](https://github.com/CircularRuins/Komorebi/tree/master/src/scripts/i18n). 
Refer to the repo of [react-intl-universal](https://github.com/alibaba/react-intl-universal) to get started on internationalization. 

If you enjoy using this app, consider supporting its development by donating through [GitHub Sponsors](https://github.com/sponsors/yang991178), [Paypal](https://www.paypal.me/yang991178), or [Alipay](https://hyliu.me/komorebi/imgs/alipay.jpg).

### Build from source
```bash
# Install dependencies
npm install

# Compile ts & dependencies
npm run build

# Start the application
npm run electron

# Generate certificate for signature
electron-builder create-self-signed-cert
# Package the app for Windows
npm run package-win

```

### Developed with

- [Electron](https://github.com/electron/electron)
- [React](https://github.com/facebook/react)
- [Redux](https://github.com/reduxjs/redux)
- [Fluent UI](https://github.com/microsoft/fluentui)
- [Lovefield](https://github.com/google/lovefield)
- [Mercury Parser](https://github.com/postlight/mercury-parser)

### License

BSD

</div>

<div class="lang-zh">

<p align="center">
  <img width="120" height="120" src="https://github.com/CircularRuins/Komorebi/raw/master/build/icon.png">
</p>
<h3 align="center">Komorebi</h3>
<p align="center">一款现代化的桌面 RSS 阅读器</p>
<p align="center">
  <img src="https://img.shields.io/github/v/release/CircularRuins/Komorebi?label=version" />
  <img src="https://img.shields.io/github/downloads/CircularRuins/Komorebi/total" />
  <img src="https://github.com/CircularRuins/Komorebi/workflows/CI%2FCD%20Release/badge.svg" />
</p>
<hr />

## 下载

您可以从 [GitHub releases](https://github.com/CircularRuins/Komorebi/releases) 获取 Komorebi。我们支持 Windows、macOS 和 Linux。

## 功能特性

<p align="center">
  <img src="https://github.com/CircularRuins/Komorebi/raw/master/docs/imgs/screenshot.jpg">
</p>

- 受 Fluent Design System 启发的现代化 UI，支持完整的深色模式。
- 本地阅读或与兼容 Fever 或 Google Reader API 的自托管服务同步。
- 与 RSS 服务同步，包括 Inoreader、Feedbin、The Old Reader、BazQux Reader 等。
- 导入或导出 OPML 文件，完整的应用程序数据备份和恢复。
- 使用内置文章视图阅读完整内容，或默认加载网页。
- 使用正则表达式搜索文章或按阅读状态筛选。
- 使用类似文件夹的分组来组织您的订阅。
- 单键[键盘快捷键](https://github.com/CircularRuins/Komorebi/wiki/Support#keyboard-shortcuts)。
- 使用正则表达式规则自动隐藏、标记为已读或收藏文章。
- 在后台获取文章并发送推送通知。

对其他 RSS 服务的支持正在[筹款中](https://github.com/CircularRuins/Komorebi/issues/23)。

## 开发

### 贡献

通过 [GitHub issues](https://github.com/CircularRuins/Komorebi/issues) 报告错误或提出功能请求，帮助改进 Komorebi。

您也可以通过提供[其他语言的翻译](https://github.com/CircularRuins/Komorebi/tree/master/src/scripts/i18n)来帮助应用程序的国际化。参考 [react-intl-universal](https://github.com/alibaba/react-intl-universal) 的仓库开始国际化工作。

如果您喜欢使用这个应用程序，可以考虑通过 [GitHub Sponsors](https://github.com/sponsors/yang991178)、[Paypal](https://www.paypal.me/yang991178) 或 [Alipay](https://hyliu.me/komorebi/imgs/alipay.jpg) 捐赠来支持其开发。

### 从源码构建
```bash
# 安装依赖
npm install

# 编译 TypeScript 和依赖
npm run build

# 启动应用程序
npm run electron

# 生成签名证书
electron-builder create-self-signed-cert
# 为 Windows 打包应用程序
npm run package-win

```

### 开发技术栈

- [Electron](https://github.com/electron/electron)
- [React](https://github.com/facebook/react)
- [Redux](https://github.com/reduxjs/redux)
- [Fluent UI](https://github.com/microsoft/fluentui)
- [Lovefield](https://github.com/google/lovefield)
- [Mercury Parser](https://github.com/postlight/mercury-parser)

### 许可证

BSD

</div>
