(function Viewer() {

	//-----------------------------------------------------dispatch
	var dispatch = {
		Setup: Setup,
		Start: Start
	};

	return {
		dispatch: dispatch
	};

	function Setup(com, fun) {
		console.log('--View/Setup');
		var that = this;
		var Vlt = this.Vlt;
		var Par = this.Par;
		var div = document.getElementById(Par.Div);
		var Vew = {};
		$('#'+Par.Div).data('View', Vew);
		Vew.Render = new THREE.WebGLRenderer({antialias: true});
		Vew.Render.setClearColor(0xBEDCF7, 1);
		Vew.Render.setSize(div.scrollWidth, div.scrollHeight);
		Vew.Scene = new THREE.Scene();
		Vew.Focus = new THREE.Vector3(0.0, 0.0, 0.0);
		Vew.Camera = new THREE.PerspectiveCamera(45,
			div.scrollWidth / div.scrollHeight, 0.1, 40000);
		div.appendChild(Vew.Render.domElement);
		Vew.Light = new THREE.DirectionalLight(0xFFFFFF);
		Vew.Light.position.set(-40, 60, 100);
		Vew.Scene.add(Vew.Light);
		Vew.Ambient = new THREE.AmbientLight(0x808080);
		Vew.Scene.add(Vew.Ambient);
		var axes = new THREE.AxisHelper(100);
		axes.position.z = 0.01;
		Vew.Scene.add(axes);
		Vew.Camera.position.x = -7;
		Vew.Camera.position.y = -20.0;
		Vew.Camera.position.z = 20.0;
		Vew.Camera.up.set(0.0, 0.0, 1.0);
		Vew.Camera.lookAt(Vew.Focus);
		Vew.Camera.updateProjectionMatrix();
		if(fun)
			fun();
	}

	function Start(com, fun) {
		console.log('--View/Start');
		var that = this;
		var Par = this.Par;
		var Vew = $('#'+Par.Div).data('View');
		var q = {};
		q.Cmd = 'GetGraph';
		this.send(q, Par.Scene, scene);

		function scene(err, q) {
			console.log('..View/scene');
			console.log(JSON.stringify(q, null, 2));
			if(err) {
				console.log(' ** ERR:' + err);
				if (fun)
					fun(err);
				return;
			}
			var root = new THREE.Object3D();
			var tree = q.Graph; // Array of instances
			async.eachSeries(tree, instance, render);

			function instance(inst, func) {
				if(!('Model' in inst)) {
					if(fun)
						fun();
					return;
				}
				var q = {};
				q.Cmd = 'GetModel';
				that.send(q, inst.Model, reply);

				function reply(err, r) {
					console.log('..reply', r);
					console.log('..reply, model received');
					var type = r.Model.Type;
					if(!(type in Par.Gen)) {
						var err = 'No translation for type ' + type;
						console.log(' ** ERR:' + err);
						func(err);
						return;
					}
					var gen = {};
					gen.Cmd = 'GenModel';
					gen.Model = r.Model.X3D;
					console.log('Par', Par);
					that.send(gen, Par.Gen[type], back);

					function back(err, x) {
						if(err) {
							func(err);
							return;
						}
						if(!('Obj3D' in x)) {
							var err = 'No model returned';
							console.log(' ** ERR:' + err);
							func(err);
							return;
						}
						Vew.Scene.add(x.Obj3D);
						func();
					}
				}
			}

			function render() {
				renderLoop();
				if(fun)
					fun();
			}
		}

		//-----------------------------------------------------Render
		function renderLoop() {
			loop();

			function loop() {
				Vew.Render.render(Vew.Scene, Vew.Camera);
				requestAnimationFrame(loop);
			}
		}
	}

})();
