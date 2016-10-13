var scene = null;
var stats = null;
window.addEventListener('load', function() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var canvas = document.getElementById('display');
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = w;
    canvas.height = h;
    scene = new Scene(canvas);
    stats = new Stats();
    document.getElementById("data").appendChild(stats.domElement);
    function step() {
        scene.step();
    }
    function render() {
        stats.begin();
        scene.render();
        stats.end();
        window.requestAnimationFrame(render);
    }
    window.requestAnimationFrame(render);
    setInterval(step, 1000 / Scene.FPS);

    /*
    document.getElementById('doBlur')
        .addEventListener('change', function() {
            scene.doBlur = this.checked;
        });
    document.getElementById('doThreshold')
        .addEventListener('change', function() {
            scene.doThreshold = this.checked;
        });
    */
});
