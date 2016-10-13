function Scene(canvas) {
    this.width = canvas.width / 10;
    this.height = canvas.height / 10;
    this.time = 0;
    this.threshold = 0.3;

    this.PARTICLE_SIZE = 0.5;
    this.PARTICLE_SPAWN_SIZE = this.PARTICLE_SIZE;

    this.doBlur = true;
    this.doThreshold = true;

    this.world = new B.World(Scene.GRAVITY, false);
    this.polys = [];
    this.buildOuter();
    this.addSpike(new B.Vec2( Scene.SPIKE_EXTENT, 0),  1);
    this.addSpike(new B.Vec2(-Scene.SPIKE_EXTENT, 0), -1);

    this.pc_blue = new Box2D.b2ParticleColor(0, 0, 255, 1);
    var psd = new Box2D.b2ParticleSystemDef();
    psd.set_radius(this.PARTICLE_SIZE);
    this.particleSystem = this.world.CreateParticleSystem(psd);

    /* load rube */
    /*
    sceneJso = JSON.parse(game.cache.getText('sceneText'));
    if ( loadSceneIntoWorld(sceneJso, world) )
        console.log("RUBE scene loaded successfully.");
    else
        console.log("Failed to load RUBE scene");
    if ( world.images ) {
        console.log("Loading " + world.images.length + " images");
    }
    */

    //PTM = 40;
    //setViewCenterWorld( {x:0, y:0} );

    /* spawn some particles */
    for (var i = 0; i < Scene.PARTICLE_COUNT; i++) {
        this.addParticle();
    }
    this.balls = [];
    for (var i = 0; i < Scene.BALL_COUNT; i++) {
        this.addBall();
    }

    this.fps = new FPS();
    var gl = this.gl = Igloo.getContext(canvas);
    if (gl == null) {
        alert('Could not initialize WebGL!');
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    function program(v, f) {
        return new Igloo.Program(gl, 'src/' + v, 'src/' + f);
    }
    this.programs = {
        particles: program('particle.vert', 'particle.frag'),
        balls:     program('ball.vert',     'ball.frag'),
        blur:      program('identity.vert', 'blur.frag'),
        threshold: program('identity.vert', 'threshold.frag'),
        spikes:    program('identity.vert', 'color.frag')
    };

    var spikes = [];
    var w = this.width, h = this.height;
    this.polys.forEach(function(poly) {
        var x = poly.pos.get_x(), y = poly.pos.get_y();
        poly.verts.forEach(function(vert) {
            spikes.push((vert.get_x() + x) / w * 2);
            spikes.push((vert.get_y() + y) / h * 2);
        });
    });

    this.buffers = {
        particles:  new Igloo.Buffer(gl),
        balls:  new Igloo.Buffer(gl),
        colors:  new Igloo.Buffer(gl),
        spikes: new Igloo.Buffer(gl, new Float32Array(spikes)),
        quad:   new Igloo.Buffer(gl, new Float32Array([
                -1, -1, 1, -1, -1, 1, 1, 1
        ]))
    };

    this.fbo = gl.createFramebuffer();
    this.textures = {
        front: this.createTexture(),
        back:  this.createTexture()
    };
}

Scene.FPS = 60;
Scene.PARTICLE_COUNT = 3000;
Scene.BALL_COUNT = 5;
Scene.BALL_RADIUS = 3;
Scene.BALL_DENSITY = 10;
Scene.BALL_FRICTION = 0;
Scene.BALL_RESTITUTION = 0.3;
Scene.GRAVITY = new B.Vec2(0, -10);
Scene.NGRAVITY = new B.Vec2(0, -Scene.GRAVITY.get_y());
Scene.FLIP_RATE = 10;
Scene.SPIKE_THICKNESS = 12;
Scene.SPIKE_EXTENT = 50;

/**
 * @param {number} x A dimension
 * @returns {number} The smallest power of 2 >= x
 */
Scene.highest2 = function(x) {
    return Math.pow(2, Math.ceil(Math.log(x) / Math.LN2));
};

Scene.prototype.texScale = function() {
    return vec2(Scene.highest2(this.gl.canvas.width),
                Scene.highest2(this.gl.canvas.height));
};

/**
 * @returns {WebGLTexture} An appropriately initialized intermediate texture
 */
Scene.prototype.createTexture = function() {
    var gl = this.gl, tex = gl.createTexture(),
        scale = this.texScale();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, scale.x, scale.y,
                  0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
};

/**
 * Swaps the front and back textures and bind the back texture.
 */
Scene.prototype.swap = function() {
    var gl = this.gl,
        temp = this.textures.front;
    this.textures.front = this.textures.back;
    this.textures.back = temp;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.back);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                            gl.TEXTURE_2D, this.textures.back, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.front);
    return this;
};

Scene.prototype.buildOuter = function() {
    var thickness = 0.1;
    var box = new B.PolygonShape(), def = new B.BodyDef();

    def.set_position(new B.Vec2(this.width / 2, 0));
    box.SetAsBox(thickness / 2, this.height / 2);
    this.world.CreateBody(def).CreateFixture(box, 0);

    def.set_position(new B.Vec2(-this.width / 2, 0));
    box.SetAsBox(thickness / 2, this.height / 2);
    this.world.CreateBody(def).CreateFixture(box, 0);

    def.set_position(new B.Vec2(0, this.height / 2));
    box.SetAsBox(this.width / 2, thickness / 2);
    this.world.CreateBody(def).CreateFixture(box, 0);

    def.set_position(new B.Vec2(0, -this.height / 2));
    box.SetAsBox(this.width / 2, thickness / 2);
    this.world.CreateBody(def).CreateFixture(box, 0);
};

Scene.prototype.addSpike = function(pos, dir) {
    var thickness = Scene.SPIKE_THICKNESS;
    var def = new B.BodyDef();
    def.set_position(pos);
    var verts = [
        new B.Vec2(dir * this.width / 2 - pos.get_x(), dir *  thickness / 2),
        new B.Vec2(0, 0),
        new B.Vec2(dir * this.width / 2 - pos.get_x(), dir * -thickness / 2)
    ];
    this.polys.push({pos: pos, verts: verts});
    var fix = new B.FixtureDef();
    fix.set_shape(createPolygonShape(verts));
    fix.set_density(1.0);
    fix.set_friction(0);
    this.world.CreateBody(def).CreateFixture(fix);
};

Scene.prototype.random = function() {
    return new B.Vec2(Math.random() * this.width - (this.width / 2),
                      Math.random() * this.height - (this.height / 2));
};

Scene.prototype.addParticle = function(pos) {
    pos = pos || this.random();
    var pgd = new Box2D.b2ParticleGroupDef();
    var shape = new Box2D.b2CircleShape();
    shape.set_m_radius(this.PARTICLE_SPAWN_SIZE);
    pgd.set_shape(shape);
    pgd.set_color(this.pc_blue);
    // need to add flag (1<<14) for contact listener
    // pgd.set_flags(1<<5);
    shape.set_m_p(pos);
    group = this.particleSystem.CreateParticleGroup(pgd);
}

Scene.prototype.addBall = function(pos) {
    pos = pos || this.random();
    var def = new B.BodyDef();
    def.set_position(pos);
    def.set_type(B.b2_dynamicBody);
    var circle = new B.CircleShape();
    circle.set_m_radius(Scene.BALL_RADIUS);
    var mass = new B.FixtureDef();
    mass.set_shape(circle);
    mass.set_density(Scene.BALL_DENSITY);
    mass.set_friction(Scene.BALL_FRICTION);
    mass.set_restitution(Scene.BALL_RESTITUTION);
    this.balls.push(this.world.CreateBody(def).CreateFixture(mass));
};

Scene.prototype.render = function() {
    var gl = this.gl;
    var w = this.gl.canvas.width, h = this.gl.canvas.height;
    var sx = w / this.width * 2, sy = h / this.height * 2;


    /* Update balls vertex attribute. */
    var pos = new Float32Array(this.balls.length * 2);
    for (var i = 0; i < this.balls.length; i++) {
        var p = this.balls[i].GetBody().GetPosition();
        pos[i * 2 + 0] = p.get_x() / w * sx;
        pos[i * 2 + 1] = p.get_y() / h * sy;
    }
    this.buffers.balls.update(pos);

    /* Update particles vertex attribute. */
    var count = this.particleSystem.GetParticleCount();
    //console.log(count);
    var pos_offset = this.particleSystem.GetPositionBuffer();
    var raw_pos = new Float32Array(Module.HEAPU8.buffer, pos_offset.e, count * 2);
    var pos = new Float32Array(count * 2);
    for (var i = 0; i < count; i++) {
        pos[i * 2 + 0] = raw_pos[i * 2 + 0] / w * sx;
        pos[i * 2 + 1] = raw_pos[i * 2 + 1] / h * sy;
    }
    this.buffers.particles.update(pos);

    this.swap();
    gl.bindTexture(gl.TEXTURE_2D, this.textures.front);
    this.programs.particles.use()
        .attrib('ball', this.buffers.particles, 2)
        .uniform('size', this.PARTICLE_SIZE * sx * 0.9) // reduce the rendered particle to 90%
        .draw(gl.POINTS, count);
    this.swap();

    if (this.doBlur) {
        this.programs.blur.use()
            .attrib('position', this.buffers.quad, 2)
            .uniform('base', 0, true)
            .uniform('scale', this.texScale())
            .uniform('dir', vec2(0.0, 1.0))
            .draw(gl.TRIANGLE_STRIP, 4);
        this.swap();

        this.programs.blur
            .uniform('dir', vec2(1.0, 0.0))
            .draw(gl.TRIANGLE_STRIP, 4);
        this.swap();
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.programs.threshold.use()
        .attrib('position', this.buffers.quad, 2)
        .uniform('base', 0, true)
        .uniform('scale', this.texScale())
        .uniform('copy', !this.doThreshold, true)
        .uniform('threshold', this.threshold)
        .uniform('color', vec4(1.0, 1.0, 1.0, 1.0))
        .draw(gl.TRIANGLE_STRIP, 4);

    this.programs.spikes.use()
        .attrib('position', this.buffers.spikes, 2)
        .uniform('color', vec4(0.5, 0.5, 0.5, 1.0))
        .draw(gl.TRIANGLES, this.polys.length * 3);

    this.programs.balls.use()
        .attrib('ball', this.buffers.balls, 2)
        .uniform('size', Scene.BALL_RADIUS * sx)
        .uniform('color', vec4(215./255, 96./255, 24./255, 1.0))
        .draw(gl.POINTS, this.balls.length);
};

Scene.prototype.step = function() {
    this.fps.tick();
    this.time += 1 / Scene.FPS;
    if (Math.sin(this.time / Scene.FLIP_RATE * Math.PI) < 0) {
        this.world.SetGravity(Scene.NGRAVITY);
    } else {
        this.world.SetGravity(Scene.GRAVITY);
    }
    this.world.Step(1 / 30, 8, 3);
};
