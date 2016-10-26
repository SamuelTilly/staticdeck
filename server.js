const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const fetch = require('node-fetch');

var config = require("./webpack.config.js");
config.entry.app.unshift("webpack-dev-server/client?http://localhost:8080/");
var compiler = webpack(config);
var server = new WebpackDevServer(compiler, {
	hot: true,
	contentBase: 'build',
	publicPath: "/assets/",
	stats: { colors: true },
	clientLogLevel: "info",
	setup: function(app) {
		app.get('/set/:code', function(req, res){
			fetch('https://cdn.rawgit.com/mtgjson/mtgjson/master/json/' +
				req.params.code.toUpperCase() + '.json')
			.then(function(res) {
				return res.json();
			}).then(function(json) {
				return res.json(json);
			});
		});
	},
});
server.listen(8080);