//# sourceURL="HTTP.js"
(function Http() {
	var fs,async,jszip,path;

	//-----------------------------------------------------dispatch
	var dispatch = {
		Setup: Setup,
		Start: Start,
		GetModule: GetModule,
		'*': Publish
	};

	return {
		dispatch: dispatch
	};

	function Setup(com, fun) {
		console.log('--Http/Setup');
		if(fun)
			fun();
	}

	function Start(com, fun) {
		console.log('--Http/Start');
		var that = this;
		 fs = this.require('fs');
		 async = this.require('async');
		 jszip = this.require("jszip");
		 path = this.require("path");

		let getCertificate = (le) => {
			
			let next = (certs) => {
				// console.log('OKAY SOMETHING HAPPENED');
				// Note: you must have a webserver running
				// and expose handlers.getChallenge to it
				// in order to pass validation
				// See letsencrypt-cli and or letsencrypt-express
				// console.error('[Error]: node-letsencrypt/examples/standalone');
				// console.error(err.stack);
				steupHttps();
			}

																																	// checks :conf/renewal/:hostname.conf
			le.register({                                               // and either renews or registers
				domains: ['planit.xgraphdev.com'],                        // CHANGE TO YOUR DOMAIN
				email: 'marcus.gosselin@introspectivesystems.com',        // CHANGE TO YOUR EMAIL
				agreeTos: true,                                           // set to true to automatically accept an agreement
				rsaKeySize: 2048																					// which you have pre-approved (not recommended)
			}).then(next);


		};

		let setupHttp = () => {
			let http = this.require('http');
			
			let LE = this.require('greenlock');
			// var LE = this.require('../');
			let db = {};
	
			let leHttpChallenge = this.require('le-challenge-fs').create({
				webrootPath: path.join(process.cwd(), 'LE/'),                      // or template string such as 
				debug: true                                            // '/srv/www/:hostname/.well-known/acme-challenge' 
			});


			let leSniChallenge = this.require('le-challenge-sni').create({
				debug: true
			});
			let leDnsChallenge = this.require('le-challenge-dns').create({
				debug: true
			});
	
			let config = {
				// server: LE.stagingServerUrl,                               
				server: LE.productionServerUrl,
	
				configDir: 'LE',      // or /etc/letsencrypt or wherever
	
				privkeyPath: 'SSL/privkey.pem',         //
				fullchainPath: 'SSL/fullchain.pem',     // Note: both that :config and
				certPath: 'SSL/cert.pem',               //       will be templated as expected
				chainPath: 'SSL/chain.pem',             //
	
				challenges: {
					'http-01': leHttpChallenge,
					'http-02': leHttpChallenge,
					'tls-sni-01': leSniChallenge,
					'tls-sni-02': leSniChallenge,
					'dns-01': leDnsChallenge,
					'dns-02': leDnsChallenge
				},
	
				rsaKeySize: 2048,
	
				debug: true
			};
	
			let handlers = {
				setChallenge: function (opts, hostname, key, val, cb) {   // called during the ACME server handshake, before validation
	
					console.log('[SET_CHALLENGE]', opts, hostname, key, val, cb, '\n');
	
	
					db[key] = {
						hostname: hostname,
						key: key,
						val: val
					};
	
					cb(null);
				},
				removeChallenge: function (opts, hostname, key, cb) {     // called after validation on both success and failure
					// db[key] = null;
					cb(null);
				},
				getChallenge: function (opts, hostname, key, cb) {        // this is special because it is called by the webserver
					cb(null, db[key].val);                                  // (see letsencrypt-cli/bin & letsencrypt-express/standalone),
																																	// not by the library itself
				},
				agreeToTerms: function (tosUrl, cb) {                     // gives you an async way to expose the legal agreement
					cb(null, tosUrl);                                       // (terms of use) to your users before accepting
				}
			};
	
			let le = LE.create(config, handlers);
			
			let httpServer = http.createServer(function (req, res) {
				console.log('[HTTP ] ' + req.url)
				console.log(le.middleware()(req, res));

			});
			console.log(' ** Spider listening on port 8080');
			httpServer.listen(8080);
			// console.log('WE LISTENIN HTTP');
			getCertificate(le);
		}

		let steupHttps = () => {
			console.log('\nCertificates Procured, proceeding to HTTPS Setup...');
			var https = this.require('https');
			var sockio = this.require('socket.io');
	
			var port;
			var Par = this.Par;
			var Vlt = this.Vlt;
			Vlt.Session = this.genPid();
			if ('Port' in this.Par)
				port = this.Par.Port;
			else
				port = 8080;

			//TODO renew every 7500000000 ms (2.8 ish months)
			var web = https.createServer({
				key: fs.readFileSync('SSL/privkey.pem'),
				cert: fs.readFileSync('SSL/cert.pem')
				// ca: fs.readFileSync('SSL/chain.pem')
			}, function (req, res) {
				console.log('[HTTPS] ' + req.url)
				
				switch (req.method) {
				case 'POST':
					break;
				case 'GET':
					Get(that, req, res);
					break;
				}
			});
			web.listen(3443);
			webSocket(web);
			console.log(' ** Spider listening on port', port);
			fs.readFile('browser.json', function(err, data) {
				if(err) {
					console.log(' ** ERR::Cannot read browser config');
					fun(err);
					return;
				}
				Vlt.Browser = JSON.parse(data.toString());
				getscripts();
			});
	
			function getscripts() {
				that.getFile('scripts.json', function(err, data) {
					if(err) {
						console.log(' ** ERR:Cannot read script.json');
						fun(err);
						return;
					}
					Vlt.Browser.Scripts = JSON.parse(data.toString());
					getnxs();
				})
			}
	
			function getnxs() {
				that.getFile('Nxs.js', function(err, data) {					
					if(err) {
						console.log(' ** ERR:Cannot read Nxs file');
						return;
					}
					Vlt.Browser.Nxs = data.toString();
					fun();
				});
			}
	
			//---------------------------------------------------------webSocket
			function webSocket(web) {
				var listener = sockio.listen(web);
				Vlt.Sockets = {};
				var Sockets = Vlt.Sockets;
	
				listener.sockets.on('connection', function (socket) {
					// console.log('sock/connection');
					var pidsock = '';
					for(var i=0; i<3; i++)
						pidsock += that.genPid().substr(24);
					var obj = {};
					obj.Socket = socket;
					obj.User = {};
					obj.User.Pid = '160D25754C01438388CE6A946CD4480C';
					Sockets[pidsock] = obj;
	
					socket.on('disconnect', function () {
						// console.log(' >> Socket', pidsock, 'disconnected');
						delete Sockets[pidsock];
					});
	
					socket.on('error', function (err) {
						// console.log(' >> Socket', pidsock, '**ERR:' + err);
						delete Sockets[pidsock];
					});
	
					socket.on('message', function (msg) {
						// debugger;
						let err, com = JSON.parse(msg);
						if(Array.isArray(com))
							[err, com] = com; // deconstruct the array in com, if it is one.

						// console.log(' |> Http::Msg:' + com.Cmd);
						// console.log(JSON.stringify(com, null, 2));
						if (!com) {
							console.log(' ** onMessage: Invalid message');
							return;
						}
						if(com.Cmd == 'GetFile') {
							getfile();
							return;
						}
						if(com.Cmd == 'Subscribe') {
							if ('Publish' in obj.User) obj.User.Publish.push(com.Pid);
							else obj.User.Publish = [com.Pid];
							return;
						}
						if(com.Cmd == 'GetConfig') {
							getConfig();
							return;
						}
						if (!('Passport' in com)) {
							console.log(' ** ERR:No Passport in routed msg');
							return;
						}
	
						// debugger;
					//	com.Passport.User = obj.User;
						if ('Reply' in com.Passport && com.Passport.Reply) {
							if('messages' in that.Vlt && com.Passport.Pid in that.Vlt.messages) {
								that.Vlt.messages[com.Passport.Pid](err, com);
								return;
							}
							return;
						}
						that.send(com, com.Passport.To, reply);
	
						function reply(err, cmd) {
							// if(com.Passport.To == "10F9140BC9754B1DB92D26EE53CBEC96") debugger;
							if (cmd) {
								com = cmd;
							}
							com.Passport.Reply = true;
							var str = JSON.stringify([err, com]);
							socket.send(str);
						}
	
						function getConfig() {
							//debugger;
							var path = com.Path;
	
	
							// var cfg = Vlt.Browser;
							let cfg = {};
							for(let key in Vlt.Browser) {
								cfg[key] = Vlt.Browser[key];
							}
							cfg = Vlt.Browser;
							
							// socket.send(str);
	
							fs.readFile(path + '.json', function(err, data) {
								if(err) {
									console.log(' ** ERR', err);
									return;
								}
	
								cfg.Pid24 = pidsock;
								cfg.PidServer = Par.Pid;
								cfg.ApexList = Par.ApexList||{};
								
	
								let page = JSON.parse(data.toString('utf8'));
	
								for(let key in page.Modules) {
									cfg.Modules[key] = page.Modules[key];
								}

								cfg.DEBUGINFO = JSON.parse(JSON.stringify({
									VltBrowser: Vlt.Browser,
									Path: path,
									PathData: data.toString('utf8'),
									PathDataParsed: page
								}));
	
								var str = JSON.stringify(cfg);
	
								socket.send(str);
							});
						}
	
						//.....................................getfile
						/// Read file from local directory
						function getfile() {
							var path = com.File;
							that.getFile(path, function(err, data) {
								if(err) {
									console.log(' ** ERR', err);
									return;
								}
								com.Data = data.toString('utf8');
								var str = com.Data;
								if('Passport' in com)
									com.Passport.Reply = true;
								var str = JSON.stringify(com);
								socket.send(str);
							});
						}
					});
				});
			}
		}
		
		setupHttp();

	}

	//-------------------------------------------------------Publish
	// This is called when message needs to be sent to all
	// browsers that have subscribed
	function Publish(com, fun) {
		// debugger;
	//	console.log('--Publish', com.Cmd);
		fun = fun || (() => {});

		var Vlt = this.Vlt;
		var socks = Vlt.Sockets;
		var keys = Object.keys(socks);
		
		if ('Forward' in com) {
			com.Passport.To = com.Forward;
			if(fun) {
				if (!('messages' in this.Vlt)) this.Vlt.messages = {};
				this.Vlt.messages[com.Passport.Pid] = fun;
			}
		} else {

			for(var i=0; i<keys.length; i++) {
				// debugger;
				var obj = socks[keys[i]];
				var sock = obj.Socket;
				var user = obj.User;
				// debugger;
				if('Publish' in user) {
					console.log(`sm pids [${user.Publish.join(', ')}]`);
					for(let idek of user.Publish) {
						com.Passport.To = idek; //user.Publish;
						if(fun) {
							com.Passport.Disp = 'Query';
						}
						var str = JSON.stringify(com);
						console.log(JSON.stringify(com, null, 2));
						sock.send(str);
					}
				}
			}

			fun(null, com);
		}

	}

	//-------------------------------------------------------Get
	// Process GET request including authentication and
	// validation if Prequired. If anything looks fishy, simply
	// ignore the request to confuse the hackers.
	function Get(that, req, res) {
		// debugger;
		console.log();
		// console.log('--Get', req.url);
		var Par = that.Par;
		var url = Par.HTMLFile;
		// console.log("LOOOOOK HEEREEE!!! (o).(o)"+url);
		console.log(req.url);
		if(req.url == '/manifest.json' && 'Manifest' in that.Par) {
			res.writeHead(200); 
			// console.log(`"${JSON.stringify(that.Par.Manifest, null, 2)}"`);
			res.end(JSON.stringify(that.Par.Manifest, null, 2));
			return;
		}

		let path = null;
		let type = null;
		// debugger;
		let splitUrl = req.url.split(".");
		// console.log("LOOOOOK HEEREEE!!! (o).(o)"+url);
		// check if the url has file a type.
		// If the url doesn't have a file type,
		// 	load it as an .html file
		if (splitUrl.length>1){
			//console.log("Split by '.'");
			path = './static'+req.url;
			// console.log("LOOOOOK HEEREEE!!! (o).(o)"+splitUrl[splitUrl.length-1]);
			switch (splitUrl[splitUrl.length-1]){
				case 'css':
					type = 'text/css';
					break;
				case 'html':
					type = 'text/html';
					break;
				default:
					type = 'text/html';
			}
		}else {
			if (url.charAt(0) == '/')
				url = url.substr(1);
			path = './' + url + '.html';
			type = 'text/html';

		}
		fs.exists(path, html);

		function html(yes) {
			if(!yes) {
				res.writeHead(404);
				res.end('You are out of your verbial guord');
				return;
			}
			fs.readFile(path, ship);
		}

		function ship(err, data) {
			if(err) {
				res.writeHead(404);
				res.end(JSON.stringify(err));
				return;
			}
			var page = data.toString();


			res.setHeader('Content-Type', type);
			res.end(page);
		}
	}

	//-----------------------------------------------------getModule
	// Retrieve module from module server
	// For now is retrieved from local file system
	function GetModule(com, fun) {
		// console.log('--Http/GetModule', com.Module);
		//console.log(JSON.stringify(com));
		var that = this;
		var zip = new jszip();
		//var dir = that.genPath(com.Module);
		var man = [];
		this.getModule(com.Module, function(err, mod) {
			if(err) {
				console.log(' ** ERR:Cannot read module directory');
				if(fun)
					fun('Cannot read module directlry');
				return;
			}
			
			var str = JSON.stringify(mod);
			//console.log("mod is ", Object.keys(mod));
			zip.file('module.json', str);
			man.push('module.json');
			zip.file('manifest.json', JSON.stringify(man));
			zip.generateAsync({type:'base64'}).then(function(data) {
				com.Zip = data;
				fun(null, com);
			});
		});
	}

})();