const HtmlWebpackPlugin = require("html-webpack-plugin")
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")
const CopyWebpackPlugin = require("copy-webpack-plugin")
const path = require("path")

module.exports = [
    {
        mode: "production",
        entry: "./src/electron.ts",
        target: "electron-main",
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    include: /src/,
                    resolve: {
                        extensions: [".ts", ".js"],
                    },
                    use: [{ loader: "ts-loader" }],
                },
            ],
        },
        output: {
            devtoolModuleFilenameTemplate: "[absolute-resource-path]",
            path: __dirname + "/dist",
            filename: "electron.js",
        },
        node: {
            __dirname: false,
        },
        externals: {
            "openai": "commonjs openai",
            "lovefield": "commonjs lovefield",
        },
    },
    {
        mode: "production",
        entry: "./src/preload.ts",
        target: "electron-preload",
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    include: /src/,
                    resolve: {
                        extensions: [".ts", ".js"],
                    },
                    use: [{ loader: "ts-loader" }],
                },
            ],
        },
        output: {
            path: __dirname + "/dist",
            filename: "preload.js",
        },
    },
    {
        mode: "production",
        entry: "./src/index.tsx",
        target: "web",
        devtool: "source-map",
        performance: {
            hints: false,
        },
        experiments: {
            asyncWebAssembly: true,
        },
        resolve: {
            alias: {
                "react/jsx-runtime": path.resolve(__dirname, "src/react/jsx-runtime.ts"),
            },
        },
        module: {
            rules: [
                {
                    test: /\.ts(x?)$/,
                    include: /src/,
                    resolve: {
                        extensions: [".ts", ".tsx", ".js"],
                    },
                    use: [{ loader: "ts-loader" }],
                },
                {
                    test: /\.md$/,
                    type: "asset/source",
                },
                {
                    test: /\.wasm$/,
                    type: "webassembly/async",
                },
            ],
        },
        output: {
            path: __dirname + "/dist",
            filename: "index.js",
        },
        plugins: [
            new NodePolyfillPlugin(),
            new HtmlWebpackPlugin({
                template: "./src/index.html",
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, "src/more-sections"),
                        to: path.resolve(__dirname, "dist/more-sections"),
                    },
                    {
                        from: path.resolve(__dirname, "src/article"),
                        to: path.resolve(__dirname, "dist/article"),
                        // Note: article.js is a standalone browser script that runs directly
                        // It's not a module, so we copy it as-is rather than processing it through webpack
                        // This ensures it executes correctly in the browser without module wrapper
                    },
                ],
            }),
        ],
    },
]
