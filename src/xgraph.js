#! /usr/bin/env node
// anything above this line is removed on npm run build.
// -:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-:--:-

let cli = function (argv) {
	//just do a quick dumb check to see if we have node as a first argument
	let originalArgv = argv.slice(0);
	let originalCwd = process.cwd();

	if (argv[0].indexOf('node')) {
		argv = argv.slice(1);
	} else {
		console.log('REAL COMMAND LINE ARGUMENTS DETECTED. ABORT. REPEAT,\r\n\t\tAB0RT\r\n\t\t\t\tM IS5  I ON.');
		console.log('---------------------------------------------------');
		console.log(argv.join('\n'));
		console.log('---------------------------------------------------');
		process.exit(1);
	}

	const { execSync } = require('child_process');
	const fs = require('fs');
	const path = require('path');
	let state = 'production';
	if (argv.length == 1) argv[1] = 'help';
	let args = argv.slice(1);
	let pathOverrides = {};
	let nodeVersion = "8.9.1";
	let cwd = (process.cwd());
	let bindir = argv[0].substr(0, argv[0].lastIndexOf(path.sep));
	let CacheDir;
	const version = require('../package.json').version;
	const genesis = require('./Genesis.js');
	const nexus = require('./Nexus.js');
	let subcommand = '';
	let flags = {};

	let windows, mac, linux, unix, system;

	switch (process.platform) {
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

	processSwitches();

	switch (args[0]) {
		case 'x':
		case '-x':
		case 'run':
		case '--execute':
		case 'execute': {
			subcommand = 'execute';
			execute();
			break;
		}

		case 'r':
		case '-r':
		case '--reset':
		case 'reset': {
			subcommand = 'reset';
			reset();
			break;
		}

		case 'c':
		case '-c':
		case '--compile':
		case 'compile': {
			subcommand = 'compile';
			compile();
			break;
		}

		case 'd':
		case '-d':
		case '--deploy':
		case 'deploy': {
			subcommand = 'deploy';
			deploy();
			break;
		}

		case 'help':
		case 'h':
		case '-h':
		case '--help': {
			subcommand = 'help';
			help();
			break;
		}

		case 'g':
		case '-g':
		case 'generate':
		case 'init': {
			subcommand = 'generate';
			generate(args.slice(1));
			break;
		}

		case '--version':
		case "-v": {
			subcommand = 'version';
			console.log(version);
			break
		}
		default: {
			console.log(`Unknown command <${argv[1]}>`);
			help();
			break;
		}
	}

	async function generate(args) {
		switch (args[0]) {
			case 'system':
			case 's': {
				let names = args.slice(1);
				if (names.length > 0) {
					console.log(`Generate new xGraph ${names.length > 1 ? 'systems' : 'system'} with ${names.length > 1 ?
						'names' : 'name'}: ${args.slice(1)}`);
					initSystem(names);
				} else {
					console.log('No system name provided. Cannot generate system without a system name: "xgraph generate system name".');
				}
				break;
			}
			case 'module':
			case 'm': {
				let names = args.slice(1);
				if (names.length > 0) {
					console.log(`Generate new xGraph ${names.length > 1 ? 'modules' : 'module'} with ${names.length > 1 ?
						'names' : 'name'}: ${args.slice(1)}`);
					initModule(names);
				} else {
					console.log('No system name provided. Cannot generate system without a system name: "xgraph generate system name".');
				}
				break;
			}
			default: {
				console.log(`Invalid option for the generate command. Try "xgraph generate module" or "xgraph generate system".`);
			}
		}
	}

	function help() {

		let helpFile = path.join(__dirname, 'help.txt');

		let helpFileText = fs.readFileSync(helpFile);

		let helpText = `
		(function(){
			let text = \`${helpFileText}\`; 
			return text;
		})();
		`;

		let help = eval(helpText);

		console.log(help);
	}

	async function reset() {
		try {
			state = 'production';
			await genesis(Object.assign(Object.assign({ state }, flags), pathOverrides));
			let processPath = pathOverrides["cwd"] || path.resolve(`.${path.sep}`);
			// process.chdir(processPath);
			startNexusProcess();
		} catch (e) {
			console.error(e);
		}
	}

	async function deploy() {
		try {
			startNexusProcess();

		} catch (e) {
			console.error(e);
		}
	}

	async function execute() {
		try {
			state = 'development';
			await genesis(Object.assign(Object.assign({ state }, flags), pathOverrides));
			startNexusProcess();
		} catch (e) {
			console.error(e);
		}
	}

	async function compile() {
		try {
			state = 'production';
			// console.dir(pathOverrides);
			await genesis(Object.assign(Object.assign({ state }, flags), pathOverrides));
		} catch (e) {
			console.error(e);
		}
	}


	async function startNexusProcess() {
		//get the cache dir
		let cacheDir = pathOverrides["cache"];
		console.log(`Starting from ${cacheDir}`);

		// HACK: no idea whyt we're messing with this. remove it att some point and see what happens
		process.env.NODE_PATH = path.join(path.dirname(cacheDir), "node_modules");

		//combine flags and path overrides to create the options object for nexus
		let system = new nexus(Object.assign(flags, pathOverrides));
		system.on('exit', _ => {
			// HACK: to restart systems
			// HACK: to restart systems
			if (_.exitCode == 72) {
				setTimeout(_ => {
					// process.chdir(originalCwd);
					system = null
					cacheDir = null;
					cli(originalArgv);
				}, 0);
			}
		});

		try {
			await system.boot();
		} catch (e) {
			console.error(e);
			process.exit(1);
		}

	}

	function processSwitches() {
		let argIterator = (() => {
			let nextIndex = 0;
			return {
				next: () => {
					if (nextIndex < args.length) {
						let obj = {
							value: args[nextIndex],
							index: (nextIndex),
							done: false
						};
						nextIndex++;
						return obj;
					} else {
						return { done: true };
					}
				},
				delete: (count) => {
					args.splice(nextIndex - 1, count);
					nextIndex = nextIndex - count;
				}
			};
		})();

		let argumentObject = argIterator.next();

		while ('value' in argumentObject) {
			let argument = argumentObject.value;
			let i = argumentObject.index;

			if (typeof argument == 'undefined') {
				console.error('error parsing Switches');
				process.exit(1);
			}
			if (argument.startsWith('--')) {
				let key = args[i].slice(2);
				applySwitch(key, i);
			}

			argumentObject = argIterator.next();
		}

		// sanitize and default cwd
		if ('cwd' in pathOverrides && typeof pathOverrides.cwd === 'string') {
			pathOverrides['cwd'] = path.normalize(pathOverrides['cwd']);
		} else {
			pathOverrides['cwd'] = path.normalize(process.cwd());
		}

		pathOverrides.cwd = path.resolve(pathOverrides.cwd);
		if (!fs.existsSync(pathOverrides.cwd)) {
			console.error('--cwd ' + pathOverrides.cwd + ' does not exist.');
			process.exit(1);
		}

		// Directory is passed in Params.Cache or defaults to "cache" in the current working directory.
		pathOverrides["cache"] = pathOverrides["cache"] || path.resolve(pathOverrides.cwd, "cache");

		if (!('cache' in pathOverrides))
			pathOverrides.cache = 'cache';

		if (!path.isAbsolute(pathOverrides.cache)) {
			pathOverrides.cache = path.resolve(pathOverrides.cwd, pathOverrides.cache);
		}

		function applySwitch(argumentString, i) {
			let numRemainingArgs = args.length - i - 1;

			if (numRemainingArgs >= 1) { // switch has another argument
				let nextArg = args[i + 1];
				if (!nextArg.startsWith('--')) {
					//if its just some more plain text, not another switch
					//we add it to path overrides
					pathOverrides[argumentString.toLowerCase()] = args[i + 1];
					argIterator.delete(2);
				} else {
					//otherwise, we add it to flags
					flags[argumentString.toLowerCase()] = true;
					argIterator.delete(1);
				}
			} else {
				//otherwise, we add it to flags
				flags[argumentString.toLowerCase()] = true;
				argIterator.delete(1);
			}
		}
	}










	// -------------------------------------------------------------
	//                       templating stuff
	// -------------------------------------------------------------

	let launchConfigBase = {
		version: "0.2.0",
		configurations: []
	};

	let config = (repo, system) => {
		return {
			name: system,
			type: "node",
			request: "launch",
			cwd: `\${workspaceRoot}/Systems/${system}`,
			program: '${workspaceRoot}/../xGraph/Nexus/Nexus/Nexus.js',
			args: [
				"xGraph=${workspaceRoot}/../xGraph",
				`${repo}=\${workspaceRoot}`,
				"development=true"
			]
		}
	};

	function initSystem(names) {

		for (let index = 0; index < names.length; index++) {
			let systemPath;
			let name = names[index];
			createDirectories(name);
			createSystem();
		}

		function createDirectories(name) {
			let regEx = new RegExp("(?:\\.\\/?\\/)|(?:\\.\\\\?\\\\)|\\\\?\\\\|\\/?\\/");
			let makeDirectories = name.split(regEx);
			let makePath = "";
			let thisDirectory = "";

			if (path.isAbsolute(name)) {
				if (name.charAt(0) != path.sep) {
					makePath = makeDirectories.shift();
				}
				systemPath = name;
			} else {
				let sysDir = pathOverrides['cwd'] || path.resolve('./');
				makePath = sysDir;
				systemPath = path.join(sysDir, name);
			}

			console.log("Generating system in directory: ", systemPath);

			for (let i = 0; i < makeDirectories.length; i++) {
				if (makeDirectories[i] && makeDirectories[i] != "") {
					thisDirectory = makeDirectories[i];
					makePath += path.sep + thisDirectory;
					makeDirectory(makePath);
				}
			}
		}

		function createSystem() {
			const ConfigTemplate =
				{
					"Sources": {},
					"Modules": {
						"Deferred": []
					}
				};

			if (!fs.existsSync(path.join(systemPath, 'config.json'))) {
				try {
					fs.writeFileSync(path.join(systemPath, 'config.json'), JSON.stringify(ConfigTemplate, null, '\t'));
					console.log("System generated at: " + systemPath);
				} catch (e) {
				}
			} else {
				console.log(`No system generated. The system already exists: ${systemPath}`);
			}
		}
	}

	function initModule(names) {

		for (let index = 0; index < names.length; index++) {
			let modulePath;
			let name = names[index];
			let module = createDirectories(name);
			createModule(module);
		}

		function createDirectories(name) {
			let regEx = new RegExp("(?:\\.\\/?\\/)|(?:\\.\\\\?\\\\)|\\\\?\\\\|\\/?\\/");
			let makeDirectories = name.split(regEx);
			let makePath = "";
			let thisDirectory = "";

			if (path.isAbsolute(name)) {
				if (name.charAt(0) != path.sep) {
					makePath = makeDirectories.shift();
				}
				modulePath = name;
			} else {
				let moduleDir = pathOverrides['cwd'] || path.resolve('./');
				makePath = moduleDir;
				modulePath = path.join(moduleDir, name);
			}
			console.log("Generating module in directory: ", modulePath);

			for (let i = 0; i < makeDirectories.length; i++) {

				if (makeDirectories[i] && makeDirectories[i] != "") {
					thisDirectory = makeDirectories[i];
					makePath += path.sep + thisDirectory;
					makeDirectory(makePath);
				}
			}

			return thisDirectory;
		}

		function createModule(name) {
			let Schema = {
				"Apex": {
					"$Setup": "Setup",
					"$Start": "Start",
					"Entity": `${name}.js`
				}
			};

			let entityFile = path.join(__dirname, 'entity.js');

			let entityFileText = fs.readFileSync(entityFile);

			let entityText = `(function(){
				let text = \`${entityFileText}\`;
				return text;
			})();`;

			let jsTemplate = eval(entityText);

			let moduleJson = {
				"name": `${name}`,
				"version": "0.0.1",
				"info": {
					"author": ""
				},
				"doc": "README.md",
				"input": {
					"required": [
						{
							"Cmd": "",
							"required": {
							},
							"optional": {
							}
						}
					],
					"optional": [
						{
							"Cmd": "",
							"required": {
							},
							"optional": {
							}
						}
					]
				},
				"output": {
					"required": [
						{
							"par": "",
							"Cmd": "",
							"required": {
							},
							"optional": {
							}
						}
					],
					"optional": [
						{
							"par": "",
							"Cmd": "",
							"required": {
							},
							"optional": {
							}
						}
					]
				},
				"par": {
					"required": {},
					"optional": {}
				}
			};

			let testJson = {
				"State": {},
				"Cases": []
			};

			if (!fs.existsSync(path.join(modulePath, `${name}.js`))) {
				try {
					fs.writeFileSync(path.join(modulePath, 'schema.json'), JSON.stringify(Schema, null, '\t'));
					fs.writeFileSync(path.join(modulePath, `${name}.js`), jsTemplate);
					fs.writeFileSync(path.join(modulePath, 'module.json'), JSON.stringify(moduleJson, null, '\t'));
					fs.writeFileSync(path.join(modulePath, 'test.json'), JSON.stringify(testJson, null, '\t'));
					console.log("Module generated at: " + modulePath);
				} catch (e) {
				}
			} else {
				console.log("No module generated. Module already exists: " + modulePath);
			}
		}
	}

	function makeDirectory(dir) {
		try {
			fs.mkdirSync(dir);
		} catch (e) {
		}
	}

};

if (require.main === module || !('id' in module)) {
	cli(process.argv);
} else module.exports = {
	Nexus: require('./Nexus.js'),
	Genesis: require('./Genesis.js')
};
