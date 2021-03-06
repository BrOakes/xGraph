#!/usr/bin/env node

(async _ => {

	// imports
	const fs = require('fs');
	const path = require('path');
	const tar = require('targz');
	const { compile } = require('nexe');
	const createPackage = require('osx-pkg');
	const createMsi = require('msi-packager');
	const pkg = require("./package.json");
	const { execSync } = require('child_process');
	const platform = process.platform;
	const rmrf = require('rimraf');

	// process.chdir('..');

	//helper functions
		
	function exec(cmd, checkLength = false) {
		return new Promise(async (resolve) => {
			console.log(`\n> ${cmd}\n`);

			// if we dont need to check anything, just do a simple exec
			// with inherit to give isTTY: true
			if(!checkLength) {
				execSync(cmd, {stdio: 'inherit'});
				resolve();
				return;
			}

			//elsewise, lets parse this command out
			let command = cmd.split(' ')[0]
			let args = cmd.split(' ').slice(1);
			let hasOutput = false;

			// normalizing the command to a path
			command = await new Promise((resolve) => {
				try {
					//if its a file, roll with it
					fs.lstatSync(command).isFile();
					resolve(command);
				} catch (e) {
					//it probably wasnt a file though, so we'll call which on it
					which(command, (err, path) => {
						if(err) resolve(command);
						// and resolve to the path is returns.
						else resolve(path)
					});
				}
			});

			// spawn a process with all streams piped to events.
			const proc = spawn(command, args);

			// pipe streams back to our own streams
			proc.stdout.on('data', (data) => {
				if(data.toString().trim() !== '' && !hasOutput) {
					// if we get anything of substance back, remember that!
					hasOutput = true;
				}
				process.stdout.write(data.toString())
			});
			proc.stderr.on('data', (data) => process.stderr.write(data.toString()));

			// when it exits, validate its a zero, and we've had output...
			// then resolve this exec call.
			proc.on('close', (code) => {
				if(code != 0) process.exit(code);
				if(!hasOutput) process.exit(1);
				resolve();
			});
		});
		// if(output.trim() == '') {
		// 	console.log('Command machine broke.');
		// 	system.exit(1);
		// }
	}
	function ensureDir(dir) { try { fs.mkdirSync(dir); } catch (e) { if ((e.errno != -17) && (e.errno != -4075)) console.log(e); } }
	function copy(src, dst) { try { fs.writeFileSync(dst, fs.readFileSync(src)); } catch (e) { if ((e.errno != -17) && (e.errno != -4075)) console.log(e); } }
	function rmdir(dir) { try { fs.writeFileSync(dst, fs.readFileSync(src)); } catch (e) { if ((e.errno != -17) && (e.errno != -4075)) console.log(e); } }
	function include(file) {
		copy(`../src/${file}`, `temp/src/${file}`)
	}
	function createMacTarball() {
		console.log("Alternative Mac tar.gz being created since package capability is not available.")
		//make for mac
		tar.compress({
			src: "bin/mac/",
			dest: 'bin/xgraph_mac.tar.gz'
		}, function (err) {
			if (err) {
				console.log(err);
			} else {
				console.log("Mac: Done!");
			}
		});
	}
	let windows, mac, linux, unix, system;

	switch(process.platform) {
		case 'win32': {
			system = 'windows';
			windows = true;
			unix = linux = mac = false;
			break;
		}
		case 'darwin': {
			system = 'macOS';
			windows = linux = false;
			unix = mac = true;
			break;
		}
		case 'linux': {
			system = 'linux';
			linux = unix = true;
			mac = windows = false;
			break;
		}
		default: {
			// arbitrary unix system
			system = 'unix';
			unix = true;
			linux = mac = windows = false;
			break;
		}
	}

	// real code in here
	try {


		rmrf.sync('bin');

		ensureDir('bin');

		ensureDir('temp');
		ensureDir('temp/src');

		ensureDir('bin/linux');
		ensureDir('bin/linux/bin');

		ensureDir('bin/mac');
		ensureDir('bin/mac/bin');

		ensureDir('bin/windows');
		ensureDir('bin/windows/bin');

		// take src/xgraph and shape it for nexe by cutting off the hashbang declaration
		// save the result to temp/xgraph
		let xgraphFile = fs.readFileSync('../src/xgraph.js');
		xgraphFile = xgraphFile.toString();
		xgraphFile = xgraphFile.split('// -:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-')[1]
		fs.writeFileSync('temp/src/xgraph.js', xgraphFile);
		
		include('Nexus.js');
		include('Genesis.js');
		include('CacheInterface.js');
		include('SemVer.js');

		copy('../package.json', 'temp/package.json');

		process.chdir('temp');
		exec('npm install');
		process.chdir('..');

		let config = {
			cwd: 'temp',
			input: 'src/xgraph.js',
			output: '../bin/linux/bin/xgraph',
			target: 'linux-x64-8.4.0',
			bundle: true,
			fakeArgv: true,
			temp: '../NexeBin'
		};

		console.log('> Calling Nexe with\n');
		console.dir(config);
		console.time('Linux');
		console.log('\n');
		// compile temp/xgraph
		await compile(config);
		console.timeEnd('Linux');

		config.target = 'windows-x64-8.4.0';
		config.output = '../bin/windows/bin/xgraph';


		console.log('> Calling Nexe with\n');
		console.dir(config);
		console.time('Windows');
		console.log('\n');
		// compile temp/xgraph
		await compile(config);
		console.timeEnd('Windows');

		config.target = 'mac-x64-8.4.0';
		config.output = '../bin/mac/bin/xgraph';

		console.log('> Calling Nexe with\n');
		console.dir(config);
		console.time('macOS');
		console.log('\n');
		// compile temp/xgraph
		await compile(config);
		console.timeEnd('macOS');

		console.log('Compilation completed');

		// try {
		// 	tar.compress({
		// 		src: "bin/linux/",
		// 		dest: 'bin/xgraph_linux.tar.gz'
		// 	}, function (err) {
		// 		if (err) {
		// 			console.log(err);
		// 		} else {
		// 			console.log("Linux: Done!");
		// 		}
		// 	});
		// }catch(error){
		// 	console.log(error);
		// }

		// try {
		// 	var canCreatePackage = false;

		// 	if (unix) {
		// 		let xar = '';
		// 		try {
		// 			xar = (execSync('which xar').toString());
		// 		} catch (e) { }
		// 		if (xar != '') {
		// 			let bomUtils = (execSync('which mkbom').toString());
		// 			if (bomUtils != '') {
		// 				canCreatePackage = true;
		// 			} else {
		// 				console.log("Missing xar: please install using");
		// 				console.log("  'wget https://storage.googleapis.com/google-code-archive-downloads/v2/code.google.com/xar/xar-1.5.2.tar.gz && tar -zxvf ./xar-1.5.2.tar.gz && cd ./xar-1.5.2 && ./configure && make && sudo make install'");
		// 			}
		// 		} else {
		// 			console.log("Missing bomutils: please install using");
		// 			console.log("  'git clone https://github.com/hogliux/bomutils && cd bomutils && make && sudo make install'")
		// 		}
		// 	}

		// 	if (canCreatePackage) {
		// 		console.log("Building mac pkg installer.")
		// 		let buildResults = (execSync('./build_mac_pkg.sh').toString());
		// 		console.log(buildResults);
		// 		console.log("Mac: Done!");
		// 	} else {
		// 		createMacTarball();
		// 	}

		// 	//make for windows
		// 	var options = {
		// 		source: 'bin/windows',
		// 		output: 'bin/xgraph.msi',
		// 		name: 'xGraph',
		// 		upgradeCode: '67dd6b8a-fedf-4aa3-925a-d0dc4f620d8f',
		// 		version: pkg.version,
		// 		manufacturer: 'Introspective Systems, LLC.',
		// 		iconPath: 'IS.png',
		// 		executable: 'bin/windows/bin/xgraph.exe',
		// 		arch: 'x64',
		// 	};

		// 	console.log("Ignore the following DeprecationWarning from msi-packager for asynchronous function without callback.");
		// 	await new Promise(resolve => {
		// 		createMsi(options, function (err) {
		// 			if (/^win/.test(platform)) {
		// 				console.log("MSI creation can only be done on mac or linux.");
		// 				console.log('Windows: FAILED!');
		// 			} else {
		// 				if (err) throw err
		// 				console.log('Windows: Done!');
		// 			}
		// 			resolve();
		// 		});
		// 	});
		// } catch (e) {
		// 	console.log(e);
		// 	console.log('TODO: revisit how packaging works...');
		// }


	} catch (e) {
		console.log('build failed');
		console.log(e);

		try {
			rmrf.sync('temp');
		} catch (e) { }

		process.exit(1);
	}
	try {
		rmrf.sync('temp');
	} catch (e) { }

})();
