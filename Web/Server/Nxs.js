__Nexus = (function() {
	console.log(' ** Nxs executing');
	var SockIO;
	var Root;
	var Pid24;
	var PidServer;
	var PidNxs;
	var PidTop;
	var PidStart;
	var Config;
	var CurrentModule;
	var EntCache = {};
	var ModCache = {};
	var ZipCache = {};
	var SymTab = {};
	var Scripts = [];
	var Nxs = {
		genPid: genPid,
		genEntity: genEntity,
		delEntity: delEntity
	}
	var MsgFifo = [];
	var MsgPool = {};
	var that = this;
	__Config = {};
	__Config.TrackIO = false;
	__Share = {};

	return {
		start: start,
		genPid: genPid,
		send: send
	};

	function start(sockio, cfg) {
		console.log('--Nxs/start');
		console.log('cfg', JSON.stringify(cfg, null, 2));
		Pid24 = cfg.Pid24;
		PidServer = cfg.PidServer;
		SockIO = sockio;
		SockIO.removeListener('message');
		SockIO.on('message', function (data) {
			var cmd = JSON.parse(data);
			console.log(' << Msg:' + cmd.Cmd);
			if ('Passport' in cmd && cmd.Passport.Reply) {
				var pid = cmd.Passport.Pid;
				var ixmsg = MsgFifo.indexOf(pid);
				if (ixmsg >= 0) {
					var func = MsgPool[pid];
					delete MsgPool[pid];
					MsgFifo.splice(ixmsg, 1);
					if (func) {
						func(null, cmd);
					}
				}
				return;
			}
			// Not reply, try to dispatch on browser
			var pid = cmd.Passport.To;
			var pid24 = pid.substr(0, 24);
			if (pid24 == Pid24) {
				if (pid in EntCache) {
					var ent = EntCache[pid];
					if('Disp' in cmd && cmd.Disp == 'Query')
						ent.dispatch(cmd, reply);
					else
						ent.dispatch(cmd);
				} else {
					console.log(' ** ERR:Local', pid, 'not in Cache');
				}
				return;
			}

			function reply(err, cmd) {
				if (cmd == null)
					return;
				if ('Passport' in cmd) {
					cmd.Passport.Reply = true;
					var str = JSON.stringify(cmd);
					SockIO.send(str);
				}
			}
		});
		Genesis(cfg);
	}

	//-----------------------------------------------------send
	// Can be called with 1, 2, or three arguments.
	//  1 - com sent to creating Nexus.
	//  2 - com sent to particular entity, no return
	//  3 - com sent to particular entity with callback
	function send(com, pid, fun) {
		if (!('Passport' in com))
			com.Passport = {};
		var pidmsg = genPid();
		com.Passport.Pid = pidmsg;

        if (pid) {
        	if(pid.charAt(0) == '$') {
        		var sym = pid.substr(1);
        		if(sym in Root.Global)
        			pid = Root.Global[sym];
			}
            com.Passport.To = pid;

            if (pid.charAt(0) != '$') {
                var pid24 = pid.substr(0, 24);
                if (pid24 == Pid24) {
                    if (pid in EntCache) {
                        var ent = EntCache[pid];
                        ent.dispatch(com, fun);
                    } else {
                        console.log(' ** ERR:Local', pid, 'not in Cache');
                    }
                    return;
                }
            } else if (pid.substr(1) in SymTab) {
            	pid = SymTab[pid.substr(1)];
				if (pid in EntCache) {
					var ent = EntCache[pid];
					ent.dispatch(com, fun);
				} else {
					console.log(' ** ERR:Local', pid, 'not in Cache');
				}
				return;
			}
        }
        if (fun) {
            MsgPool[pidmsg] = fun;
            MsgFifo.push(pidmsg);
            if (MsgFifo.length > 100) {
                var kill = MsgFifo.shift();
                delete MsgPool[kill];
            }
        }
        var str = JSON.stringify(com);
        if(__Config.TrackIO)
            console.log(' >> Msg:' + com.Cmd);
        SockIO.send(str);

		function sendLocal() {
            if (pid in EntCache) {
                var ent = EntCache[pid];
                ent.dispatch(com, fun);
            } else {
                console.log(' ** ERR:Local', pid, 'not in Cache');
            }
		}
	}

	//--------------------------------------------------------Entity
	// Entity base class
	function Entity(nxs, mod, par) {
		var Nxs = nxs;
		var Par = par;
		var Mod = mod;
		var Vlt = {};

		return {
			Par: Par,
			Mod: Mod,
			Vlt: Vlt,
			Nxs: Nxs,
			dispatch: dispatch,
			send: send,
			getPid: getPid
		}

		//-------------------------------------------------dispatch
		// This is used by Nexus to dispatch incoming messages.
		// It should not be used internally unless you have a
		// prediliction to talk to yourself =)
		function dispatch(com, fun) {
			var disp = Mod.dispatch;
			if (com.Cmd in disp) {
				disp[com.Cmd].call(this, com, fun);
				return;
			}
			if ('*' in disp) {
				disp['*'].call(this, com, fun);
				return;
			}
			console.log(com.Cmd + ' unknown');
			if(fun)
				fun(com.Cmd + ' unknown');
		}

		//-------------------------------------------------getPid
		// Return Pid of entity
		function getPid() {
			return Par.Pid;
		}

		//-------------------------------------------------send
		function send(com, pid, fun) {
			com.Passport = {};
			if(fun)
				com.Passport.From = Par.Pid;
			com.Passport.To = pid;
			__Nexus.send(com, pid, fun);
		}

		//-------------------------------------------------reply
		// Reply to a message previously received
		function reply(com, fun) {

		}
	}

	//-----------------------------------------------------genNode
	// Generate node from parameter object
	function genEntity(par, fun) {
	//	console.log('--genEntity', par.Entity);
		var name = par.Entity;
		if (name in ModCache) {
			var mod = ModCache[name];
			var pid = genPid();
			par.Pid = pid;
			ent = new Entity(Nxs, mod, par);
			if (ent) {
				EntCache[pid] = ent;
				if (par.$Browser) {
					SymTab[par.$Browser] = pid;
				}
				fun(null, ent);
				return;
			}
			fun('genEntity failed');
			return;
		}
		var com = {};
		com.Cmd = 'GetEntityMod';
		var name = par.Entity;
		com.Name = name;
		send(com, null, done);

		function done(err, com) {
			if (!('Mod' in com)) {
				var errmsg = com.Name +  'module is not available';
				console.log(' ** ERR:' + errmsg);
				fun(err);
			}
			var pid = genPid();
			par.Pid = pid;
			// if
			var mod = eval(com.Mod);
			var ent = new Entity(Nxs, mod, par);
			if (ent) {
				ModCache[name] = mod;
				EntCache[pid] = ent;
//                if (par.$Browser) {
//                	SymTab[par.$Browser] = pid;
//                }
				fun(null, ent);
				return;
			}
			fun('Entity creation failed');
		}
	}

    //-----------------------------------------------------delEntity
    // Generate node from parameter object
    function delEntity(pid, fun) {
		if (EntCache[pid]) {
			delete EntCache[pid];
			console.log(pid, ' Deleted');
			if (fun) {
				fun(null)
			}
		} else {
			console.log('Entity not found: ', pid);
		}
    }

	//------------------------------------------------------genPid
	// Generate Pid (pseudo-GUID)
	function genPid() {
		var pid = Pid24;
		var hexDigits = "0123456789ABCDEF";
		for (var i = 0; i < 8; i++)
			pid += hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
		return pid;
	}

	//-----------------------------------------------------Genesis
	// Create cache if it does nto exist and populate
	// This is called only once when a new systems is
	// first instantiated
	function Genesis(cfg) {
		console.log('--Nxs/Genesis');
		Config = cfg;
		Root = {};
		Root.Global = {};
		Root.Setup = {};
		Root.Start = {};
		if('Apex' in cfg)
			Root.Apex = cfg.Apex;
		else
			Root.Apex = {};
		scripts();

		function scripts() {
			var ikey = 0;
			if('Scripts' in Config) {
				var keys = Object.keys(Config.Scripts);
				nkeys = keys.length;
			} else {
				nkeys = 0;
			}
			nextscript();

			function nextscript() {
			//	console.log('..nextscript');
				if (ikey >= nkeys) {
					modules();
					return;
				}
				var key = keys[ikey];
				ikey++;
				var q = {};
				q.Cmd = 'GetFile';
				q.File = Config.Scripts[key];
				send(q, Config.pidServer, function(err, r) {
					if(err) {
						console.log(' ** ERR:Script error', err);
						return;
					}
					script(key, r.Data);
				});
			}

			function script(url, data) {
				var tag = document.createElement('script');
				tag.setAttribute("data-script-url", url);
				tag.setAttribute("type", 'text/javascript');
				var txt = document.createTextNode(data);
				tag.appendChild(txt);
				document.head.appendChild(tag);
				nextscript();
			}
		}

		function modules() {
			// Merge npm package dependencies
			var keys = Object.keys(Config.Modules);
			var key;
			var nkeys = keys.length;
			var ikey = 0;
			var mod;
			var modkey;
			for(var i=0; i<keys.length; i++) {
				key = keys[i];
				Root.Apex[key] = genPid();
			}
			nextmodule();

			function nextmodule() {
			//	console.log('..nextmodule')
				if(ikey >= nkeys) {
					Setup();
					return;
				}
				modkey = keys[ikey];
				mod = Config.Modules[modkey];
				ikey++;
				var com = {};
				com.Cmd = 'GetModule';
				com.Module = mod.Module;
			//	console.log(com);
				send(com, PidServer, addmodule);
			}

			function addmodule(err, com) {
			//	console.log('..addmodule');
				var ents = {};
				var lbls = {};
				var module = com.Module;
				var zipmod = new JSZip();
				zipmod.loadAsync(com.Zip, {base64: true}).then(function(zip){
					var dir = zipmod.file(/.*./);
					scripts();

					function scripts() {
						if(zipmod.file('scripts.json')) {
							zip.file('scripts.json').async('string').then(function(str) {
								var obj = JSON.parse(str);
								var keys = Object.keys(obj);
								async.eachSeries(keys, function(key, func) {
									if(Scripts.indexOf(key) >= 0) {
										func();
										return;
									}
									Scripts.push(key);
									var file = obj[key];
									zip.file(file).async('string').then(function(scr) {
										var tag = document.createElement('script');
										tag.setAttribute("data-script-url", key);
										tag.setAttribute("type", 'text/javascript');
										var txt = document.createTextNode(scr);
										tag.appendChild(txt);
										document.head.appendChild(tag);
										func();
									});
								}, schema);
							});
						} else {
							schema();
						}
					}

					function schema() {
						zip.file('schema.json').async('string').then(function(str){
							compile(str);
						});
					}
				});

				function compile(str) {
					var schema = JSON.parse(str);
					ZipCache[module] = zipmod;
					for (let lbl in schema) {
						var ent = schema[lbl];
						if('Par' in mod) {
							for(key in mod.Par) {
								ent[key] = mod.Par[key];
							}
						}
						CurrentModule = modkey;
						ent.Module = module;
						if(lbl == 'Apex')
							ent.Pid = Root.Apex[modkey];
						else
							ent.Pid = genPid();
						lbls[lbl] = ent.Pid;
						ents[lbl] = ent;
					}
					var keys = Object.keys(ents);
					var nkey = keys.length;
					var ikey = 0;
					nextent();

					function nextent() {
						if(ikey >= nkey) {
							nextmodule();
							return;
						}
						var key = keys[ikey];
						var ent = ents[key];
						if('Par' in mod) {
							for(key in mod.Par) {
								ent[key] = mod.Par[key];
							}
						}
						ikey++;
						for (let key in ent) {
							val = ent[key];
							if (key == '$Setup') {
								Root.Setup[ent.Pid.substr(24)] = ent[key];
								continue;
							}
							if (key == '$Start') {
								Root.Start[ent.Pid.substr(24)] = ent[key];
								continue;
							}
							if(typeof val == 'string')
								ent[key] = symbol(val);
							if(Array.isArray(val)) {
								for (var i = 0; i < val.length; i++) {
									if (typeof val[i] == 'string')
										val[i] = symbol(val[i]);
								}
								continue;
							}
							if(typeof val == 'object') {
								for(let sym in val) {
									var tmp = val[sym];
									if(typeof tmp == 'string')
										val[sym] = symbol(tmp);
								}
							}
						}
						var modkey = ent.Module + '/' + ent.Entity;
						ZipCache[mod] = zipmod;
						zipmod.file(ent.Entity).async('string').then(function(str){
							var mod = eval(str);
							ModCache[modkey] = mod;
							EntCache[ent.Pid] = new Entity(Nxs, mod, ent);
							nextent();
						});
					}

					function symbol(str) {
						if(str.charAt(0) == '#') {
							var lbl = str.substr(1);
							if(!(lbl in lbls)) {
								var err = ' ** Symbol ' + lbl + ' not defined';
								throw err;
							}
							return lbls[lbl];
						}
						if(str.charAt(0) == '$') {
							var sym = str.substr(1);
							if(!(sym in Root.Apex)) {
								var err = ' ** Symbol ' + sym + ' not defined';
								throw err;
							}
							return Root.Apex[sym];
						}
						return str;
					}
				}
			}
		}

		//---------------------------------------------------------start
		function Setup() {
			console.log('--Nexus/Setup');
			var pids = Object.keys(Root.Setup);
			var npid = pids.length;
			var ipid = 0;
			setup();

			function setup() {
				if(ipid >= npid) {
					Start();
					return;
				}
				var pid8 = pids[ipid];
				ipid++;
				var q = {};
				q.Cmd = Root.Setup[pid8];
				var pid = Pid24 + pid8;
				send(q, pid, done);

				function done(err, r) {
					setup();
				}
			}
		}

		//---------------------------------------------------------Start
		function Start() {
			console.log('--Nxs/Start');
			var pids = Object.keys(Root.Start);
			var npid = pids.length;
			var ipid = 0;
			start();

			function start() {
				if(ipid >= npid) {
					return;
				}
				var pid8 = pids[ipid];
				ipid++;
				var q = {};
				q.Cmd = Root.Start[pid8];
				var pid = Pid24 + pid8;
				send(q, pid, done);

				function done(err, r) {
					start();
				}
			}
		}

		//-----------------------------------------------------Run
		function Run() {
			console.log('--Nxs/Run');
		}
	}

})();
