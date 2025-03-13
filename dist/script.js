import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.18.2/+esm"

const containerEl = document.querySelector(".container")[0];
const canvasEl = document.querySelector("canvas");
const imgInput = document.querySelector("#image-selector-input");
canvasEl.width = 0;

const devicePixelRatio = Math.min(window.devicePixelRatio, 2);

const params = {
    tileSize: Math.floor(.06 * window.innerHeight),
    scale: 1.5,
    rotation: 0,
    useWebcam: true,
    loadImage: () => {
        imgInput.click();
    }
};

let video, image, uniforms;
const gl = initShader();
updateUniforms();

// Handle image upload
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

function loadImage(src) {
    params.useWebcam = false;
    if (video) {
        // Stop webcam if it's running
        const stream = video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        video = null;
    }

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

async function initWebcam() {
    try {
        if (image) {
            image = null;
        }
        video = document.createElement('video');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();

        video.onloadedmetadata = () => {
            const videoTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, videoTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            resizeCanvas();
        };
    } catch (err) {
        console.error("Error accessing webcam:", err);
    }
}

// Initialize based on default mode
if (params.useWebcam) {
    initWebcam();
}

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
    gl.uniform1f(uniforms.u_rotation, params.rotation * Math.PI / 180.0);
}

function render() {
    if (params.useWebcam && video && video.readyState === video.HAVE_ENOUGH_DATA) {
        gl.bindTexture(gl.TEXTURE_2D, gl.getParameter(gl.TEXTURE_BINDING_2D));
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.uniform1i(uniforms.u_image_texture, 0);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
}

function resizeCanvas() {
    if (params.useWebcam && !video) return;
    if (!params.useWebcam && !image) return;

    const ratio = params.useWebcam ?
        video.videoWidth / video.videoHeight :
        image.naturalWidth / image.naturalHeight;

    canvasEl.height = canvasEl.clientHeight * devicePixelRatio;
    canvasEl.width = canvasEl.height * ratio;
    gl.viewport(0, 0, canvasEl.width, canvasEl.height);
}

function createControls() {
    const gui = new GUI();
    gui
        .add(params, "useWebcam")
        .name("use webcam")
        .onChange(value => {
            if (value) {
                initWebcam();
            } else if (video) {
                // Stop webcam if switching to image mode
                const stream = video.srcObject;
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                video = null;
            }
        });
    gui
        .add(params, "loadImage")
        .name("load image");
    gui
        .add(params, "tileSize", 2, 50, 1)
        .onChange(updateUniforms)
        .name("tile size");
    gui
        .add(params, "scale", 0, 2, 0.1)
        .onChange(updateUniforms);
    gui
        .add(params, "rotation", 0, 20, 1)
        .onChange(updateUniforms)
        .name("rotation angle");
}