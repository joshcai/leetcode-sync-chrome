const path = require('path');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin').CleanWebpackPlugin;
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');

module.exports = {
    // mode: 'production',
    mode: 'development',
    entry: {
        popup: './src/popup/index.js',
        background: './src/background.js',
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].js'
    },
    module: {
        rules: [
          {
            test: /\.vue$/,
            loader: 'vue-loader'
          },
          // This will apply to both plain `.js` files
          // AND `<script>` blocks in `.vue` files.
          {
            test: /\.js$/,
            loader: 'babel-loader'
          },
          // This will apply to both plain `.css` files
          // AND `<style>` blocks in `.vue` files.
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader'
            ]
          }
        ]
    },
    plugins: [
        new CircularDependencyPlugin({
            // add errors to webpack instead of warnings
            failOnError: true,
            // allow import cycles that include an asyncronous import,
            // e.g. via import(/* webpackMode: "weak" */ './file.js')
            allowAsyncCycles: false,
            // set the current working directory for displaying module paths
            cwd: process.cwd(),
        }),
        // Process Vue files.
        new VueLoaderPlugin(),
        // Clean the `build` folder.
        new CleanWebpackPlugin(),
        // Copy all files from `src` to `build` folder except `background.js`.
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: "src",
                    filter: async (path) => {
                        const filterPaths = [
                            'background.js',
                            'index.html',
                            'popup/App.vue',
                            'popup/index.js',
                        ];
                        for (let filterPath of filterPaths) {
                            if (path.endsWith('src/' + filterPath)) {
                                return false;
                            }
                        }
                        return true;
                    },
                },
            ],
        }),
        new HtmlWebpackPlugin({
            title: 'Popup',
            template: './src/index.html',
            filename: 'popup.html',
            chunks: ['popup'],
        }),
    ],
};