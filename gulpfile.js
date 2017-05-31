'use strict';

const path = require('path');
const gulp = require('gulp');
const del = require('del');
const vfs = require('vinyl-fs');
const gutil = require('gulp-util');
const babel = require('gulp-babel');
const sass = require('gulp-sass');
const os = require('os');
const glob = require('glob');
const Worker = require('tiny-worker');
const NODE_ENV = process.env.NODE_ENV;
const reactPatcher = require('./gulp/gulp-react-patcher');

// list of folders from where .js files are compiled and non-js files are symlinked
const dirs = [
	'chrome',
	'components',
	'defaults',
	'resource',
	'resource/web-library',
	'test',
	'test/resource/chai',
	'test/resource/chai-as-promised',
	'test/resource/mocha'
];

// list of folders from which all files are symlinked
const symlinkDirs = [
	'styles',
	'translators',
	'test/tests/data'
];

// list of files from root folder to symlink
const symlinkFiles = [
	'chrome.manifest', 'install.rdf', 'update.rdf'
];

const jsGlob = `./\{${dirs.join(',')}\}/**/*.js`;
const jsGlobIgnore = `./\{${symlinkDirs.join(',')}\}/**/*.js`;

function onError(err) {
	gutil.log(gutil.colors.red('Error:'), err);
	this.emit('end');
}

function onSuccess(msg) {
	gutil.log(gutil.colors.green('Build:'), msg);
}

function getJS(source, sourceIgnore) {
	if (sourceIgnore) {
		source = [source, '!' + sourceIgnore];
	}
	return gulp.src(source, { base: '.' })
		.pipe(babel())
		.pipe(reactPatcher())
		.on('error', onError)
		.on('data', file => {
			onSuccess(`[js] ${file.path}`);
		})
		.pipe(gulp.dest('./build'));
}

function getJSParallel(source, sourceIgnore) {
	const jsFiles = glob.sync(source, { ignore: sourceIgnore });
	const cpuCount = os.cpus().length;
	const threadCount = Math.min(cpuCount, jsFiles.length);
	let threadsActive = threadCount;

	return new Promise((resolve, reject) => {
		for(let i = 0; i < threadCount; i++) {
			let worker = new Worker('gulp/babel-worker.js');
			worker.onmessage = ev => {
				if(ev.data.isError) {
					reject(`Failed while processing ${ev.data.sourcefile}`);
				}

				NODE_ENV == 'debug' && console.log(`process ${i} took ${ev.data.processingTime} ms to process ${ev.data.sourcefile}`);
				NODE_ENV != 'debug' && onSuccess(`[js] ${ev.data.sourcefile}`);
				
				if(ev.data.isSkipped) {
					NODE_ENV == 'debug' && console.log(`process ${i} SKIPPED ${ev.data.sourcefile}`);
				}
				let nextFile = jsFiles.pop();

				if(nextFile) {
					worker.postMessage(nextFile);
				} else {
					NODE_ENV == 'debug' && console.log(`process ${i} has terminated`);
					worker.terminate();
					if(!--threadsActive) {
						resolve();
					}
				}
			};
			worker.postMessage(jsFiles.pop());
		}
		
		NODE_ENV == 'debug' && console.log(`Started ${threadCount} processes for processing JS`);
	});
}

function getSymlinks() {
	const match = symlinkFiles
		.concat(dirs.map(d => `${d}/**`))
		.concat(symlinkDirs.map(d => `${d}/**`))
		.concat([`!./{${dirs.join(',')}}/**/*.js`]);

	return gulp
		.src(match, { nodir: true, base: '.', read: false })
		.on('error', onError)
		.on('data', file => {
			onSuccess(`[ln] ${file.path.substr(__dirname.length + 1)}`);
		})
		.pipe(vfs.symlink('build/'));
}

function getSass() {
	return gulp
		.src('scss/*.scss')
		.on('error', onError)
		.pipe(sass())
		.pipe(gulp.dest('./build/chrome/skin/default/zotero/components/'));
}


gulp.task('clean', () => {
	return del('build');
});

gulp.task('symlink', ['clean'], () => {
	return getSymlinks();
});

gulp.task('js', done => {
	getJSParallel(jsGlob, jsGlobIgnore).then(() => done());
});

gulp.task('sass', () => {
	return getSass();
});

gulp.task('build', ['js', 'sass', 'symlink']);

gulp.task('dev', ['clean'], () => {
	var interval = 750;
	
	let watcher = gulp.watch(jsGlob, { interval });

	watcher.on('change', function(event) {
		getJS(event.path, jsGlobIgnore);
	});

	gulp.watch('src/styles/*.scss', { interval }, ['sass']);
	gulp.start('build');
});

gulp.task('default', ['dev']);