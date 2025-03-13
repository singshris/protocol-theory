import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.18.2/+esm"

const containerEl = document.querySelector(".container")[0];
const canvasEl = document.querySelector("canvas");
const imgInput = document.querySelector("#image-selector-input");
canvasEl.width = 0;

const devicePixelRatio = Math.min(window.devicePixelRatio, 2);

const params = {
    tileSize: Math.floor(.06 * window.innerHeight),
    scale: .5,
    loadMyImage: () => {
        imgInput.click();
    }
};

imgInput.onchange = () => {
    const [file] = imgInput.files;
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            loadImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }
};


let image, uniforms;
const gl = initShader();
updateUniforms();
loadImage("https://images.spr.so/cdn-cgi/imagedelivery/j42No7y-dcokJuNgXeA0ig/70eba205-d7a4-48fa-ba0f-4cefc700313d/47963d71-f58d-442b-9a6f-a2f1e89bc95e/w=828,quality=90,fit=scale-down");
createControls();
render();
window.addEventListener("resize", resizeCanvas);


function initShader() {
    const vsSource = document.getElementById("vertShader").innerHTML;
    const fsSource = document.getElementById("fragShader").innerHTML;

    const gl = canvasEl.getContext("webgl") || canvasEl.getContext("experimental-webgl");

    if (!gl) {
        alert("WebGL is not supported by your browser.");
    }

    function createShader(gl, sourceCode, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, sourceCode);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    const vertexShader = createShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = createShader(gl, fsSource, gl.FRAGMENT_SHADER);

    function createShaderProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Unable to initialize the shader program: " + gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    const shaderProgram = createShaderProgram(gl, vertexShader, fragmentShader);
    uniforms = getUniforms(shaderProgram);

    function getUniforms(program) {
        let uniforms = [];
        let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            let uniformName = gl.getActiveUniform(program, i).name;
            uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
        }
        return uniforms;
    }

    const vertices = new Float32Array([-1., -1., 1., -1., -1., 1., 1., 1.]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.useProgram(shaderProgram);

    const positionLocation = gl.getAttribLocation(shaderProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    return gl;
}

function updateUniforms() {
    gl.uniform1f(uniforms.u_tile_scale, params.tileSize / canvasEl.clientHeight);
    gl.uniform1f(uniforms.u_scale, params.scale);
}

function loadImage(src) {
    image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    image.onload = () => {
        const imageTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.uniform1i(uniforms.u_image_texture, 0);
        resizeCanvas();
    };
}

function render() {
    const currentTime = performance.now();
    gl.uniform1f(uniforms.u_time, currentTime);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
}

function resizeCanvas() {
    const imgRatio = image.naturalWidth / image.naturalHeight;
    canvasEl.height = canvasEl.clientHeight * devicePixelRatio;
    canvasEl.width = canvasEl.height * imgRatio;
    gl.viewport(0, 0, canvasEl.width, canvasEl.height);
}

function createControls() {
    const gui = new GUI();
    gui.close();
    gui
        .add(params, "tileSize", 10, 100, 1)
        .onChange(updateUniforms)
        .name("tile size")
    gui
        .add(params, "scale", 0, 1)
        .onChange(updateUniforms)
    gui
        .add(params, "loadMyImage")
        .name("load image")
}