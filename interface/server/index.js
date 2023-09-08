const express = require('express');
const morgan = require('morgan')
const sassMiddleware = require('node-sass-middleware');
const _ = require('lodash');
const port = process.env.PORT || 8000;
const PATH = require("path");
const FS = require('fs');

const app = express();

app.use(morgan(':method :url :status :res[content-length] - :response-time ms'))

app.get("/css/*",
	sassMiddleware({
		src: __dirname + '/../www/sass',
		dest: __dirname + '/../www/built/css',
		debug: false,
		indentedSyntax : true,
		// outputStyle: 'compressed',
		prefix: '/css',
		force: true
	})
	,
	express.static(__dirname + '/../www/built/css')
);


app.use('/favicon.ico' , function(req , res){
	res.redirect(301, '/images/favicon.png')
});
app.use('/robots.txt', function (req, res, next) {
	res.type('text/plain')
	res.send(FS.readFileSync(__dirname + '/../www/assets/robots.txt'));
});

// app.use(express.static(__dirname + '/../www'));
app.use('/js', express.static(__dirname + '/../www/js'));
app.use('/images', express.static(__dirname + '/../www/assets/images'));
// app.use('/videos', express.static(__dirname + '/../www/assets/videos'));
// app.use('/fonts', express.static(__dirname + '/../www/assets/fonts'));
// app.use('/sounds', express.static(__dirname + '/../www/assets/sounds'));
// app.use('/css', express.static(__dirname + '/../../www/built/css'));

app.set('view engine', 'pug');
app.set('views', __dirname + '/../www/pug');

app.use((req, res, next) => {
	res.locals.version = require('../../package.json').version;
	next();
});

app.get('/', (req, res) => {
	console.log('index');
	res.render('index');
});

app.post('/github-webhook', (req, res) => {
	const { body } = req;
	if (body && body.repository && body.repository.name === 'patrickgunderson.com') {
		console.log('Received webhook for patrickgunderson.com');
		const { exec } = require('child_process');
		exec('git pull', (error, stdout, stderr) => {
			if (error) {
				console.error('Error executing git pull:', error);
				return res.sendStatus(500);
			}
			console.log('Git pull successful');
			console.log(stdout);
			console.error(stderr);

			// Execute build script here
			exec('npm run build', (error, stdout, stderr) => {
				if (error) {
					console.error('Error executing build script:', error);
					return res.sendStatus(500);
				}
				console.log('Build script executed successfully');
				console.log(stdout);
				console.error(stderr);

				// Restart PM2 process here
				exec('pm2 restart patrickgunderson.com', (error, stdout, stderr) => {
					if (error) {
						console.error('Error restarting PM2 process:', error);
						return res.sendStatus(500);
					}
					console.log('PM2 process restarted successfully');
					console.log(stdout);
					console.error(stderr);

					res.sendStatus(200);
				});
			});
		});
	} else {
		console.log('Invalid webhook payload');
		res.sendStatus(400);
	}
});

var server =app.listen(port, () => {
	console.log('Server is running on port ' + port);
});



// elegantly end the server
['SIGINT', 'SIGTERM', 'SIGQUIT']
	.forEach(signal => process.on(signal, () => {
		/** do your logic */
		server.close();
		process.exit();
	}));