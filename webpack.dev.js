const { merge } = require("webpack-merge");
const path = require("path");
const common = require("./webpack.common.js");

module.exports = merge(common, {
    mode: "development",
    output: {
        filename: "[name].bundle.js",
        path: path.join(__dirname, "build"),
    },
    devtool: "inline-source-map",
    devServer: {
        contentBase: "./build",
    },
});
