<div align="center">

<a href="https://github.com/CircularRuins/Komorebi">
<img width="128" height="128" alt="Komorebi icon" src="https://github.com/user-attachments/assets/69a65cc5-d366-4d99-81d2-a4e1072ce525" />
</a>

<h3>Komorebi</h3>

</div>

**Komorebi is not a general-purpose RSS reader.**  
It is a desktop RSS application built specifically for AI practitioners who want to stay current with:

- frontier industry thinking and commentary
- newly released AI products and real-world applications
- state-of-the-art papers and technical research

## Overview

Komorebi is an open-source, always-free RSS desktop app for Windows and macOS. It combines a curated AI-focused information network with a reading experience optimized for high-signal sources such as X/Twitter, YouTube, newsletters, and research feeds.

The project is designed to be useful out of the box: users can start with recommended sources immediately, then expand into their own custom feeds and sync services as needed.

## Why Komorebi

- **Built for AI professionals**: the product focuses on information density, source quality, and workflows relevant to people working in AI.
- **Curated from day one**: Komorebi ships with a large set of recommended AI sources, plus guides for adding more.
- **Optimized reading experience**: special attention has been given to content presentation, especially for YouTube and social-media-style sources.
- **Optional AI features**: AI-powered workflows are available, but entirely opt-in. Users bring their own API keys and model endpoints.
- **Free and open source**: the project is intended to remain free to use and open to community contributions.

## Core Features

- AI-focused recommended feeds and onboarding guides
- Multiple feed presentation modes, including card, list, magazine, and compact views
- Full desktop reading workflow with unread tracking, starring, search, and article management
- AI Search for discovering and summarizing relevant articles within a selected time range and topic
- AI-based article translation
- Token usage tracking for AI requests
- YouTube transcript retrieval and transcript-based summarization workflows



## Product Site

The product website is available at [komorebi-homepage.vercel.app](https://komorebi-homepage.vercel.app).

Note for users in mainland China: access to the website and some in-app network features may require a VPN or proxy connection.

## Installation

Komorebi is a desktop application for Windows and macOS. Prebuilt packages are available on the [GitHub Releases page](https://github.com/CircularRuins/Komorebi/releases).

### macOS Note

If macOS shows the message that the app is damaged and should be moved to the Trash, run the following command in Terminal:

```bash
sudo xattr -rd com.apple.quarantine /Applications/Komorebi.app
```

### Network Note

Some users, especially those in mainland China, may need a VPN or properly configured proxy before using the app reliably.

## AI Configuration

Komorebi's AI features are optional. To use them, configure your own OpenAI-compatible endpoints, API keys, and model names inside the app settings.

Current AI-related capabilities in the codebase include:

- chat-model-powered AI Search
- embedding-based article retrieval and filtering
- article translation
- token usage history

## Development

### Requirements

- Node.js and npm
- Python environment for the YouTube transcript helper build pipeline

### Install Dependencies

```bash
npm install
```

### Run in Development

```bash
npm run start:dev
```

### Build

```bash
npm run build
```

### Build Python Helpers

```bash
npm run build-python
```

On macOS, to build both Apple Silicon and Intel helper binaries:

```bash
npm run build-python-mac
```

### Full Local Build

```bash
npm run build-all
```

On macOS:

```bash
npm run build-all-mac
```

## Packaging

The repository includes packaging scripts for multiple targets:

- `npm run package-win`
- `npm run package-win-ci`
- `npm run package-win-nsis`
- `npm run package-mac`
- `npm run package-mas`
- `npm run package-linux`

Python helper binaries can be verified with:

```bash
npm run verify-python
```

## Tech Stack

- Electron
- React
- TypeScript
- Redux
- Webpack
- Lovefield

## Contributing

Bug reports, suggestions, and pull requests are welcome.

If you run into an issue or have an idea for improving the product, please open an issue on [GitHub Issues](https://github.com/CircularRuins/Komorebi/issues). Contributions are especially welcome in product polish, source integrations, AI workflows, and reading experience improvements.

## Acknowledgements

Special thanks to these open-source projects and resources:

- [Fluent Reader](https://github.com/yang991178/fluent-reader)
- [BestBlogs](https://github.com/ginobefun/BestBlogs)
- [longcut](https://github.com/SamuelZ12/longcut)
- [kill-the-newsletter](https://github.com/leafac/kill-the-newsletter)
- [Mercury Parser](https://github.com/postlight/mercury-parser)
- [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)
- [alphaXiv](https://www.alphaxiv.org/)
- [youtube_rss_extractor](https://github.com/jeffkeeling/youtube_rss_extractor)

## License

BSD-3-Clause
