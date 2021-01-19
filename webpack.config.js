const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin').CleanWebpackPlugin;
const CopyWebpackPlugin = require("copy-webpack-plugin");
const CircularDependencyPlugin = require('circular-dependency-plugin');

module.exports = {
    // mode: 'production',
    mode: 'development',
    entry: './src/background.js',
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'background.bundle.js'
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
        // Clean the `build` folder.
        new CleanWebpackPlugin(),
        // Copy all files from `src` to `build` folder except `background.js`.
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: "src",
                    filter: async (path) => {
                        return !path.endsWith('src/background.js');
                    },
                },
            ],
        }),
    ],
};