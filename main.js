const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl', { alpha: false, preserveDrawingBuffer: true });

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// === Shader loading ===
async function loadShaderSource(url) {
  const response = await fetch(url);
  return await response.text();
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    throw new Error('Shader compile failed');
  }
  return shader;
}

function createProgram(vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    throw new Error('Program link failed');
  }
  return program;
}

// === Main Init ===
(async function init() {
  const vsSource = await loadShaderSource('shaders/vertex.glsl');
  const fsSource = await loadShaderSource('shaders/fragment.glsl');
  const program = createProgram(vsSource, fsSource);
  gl.useProgram(program);

  // Fullscreen quad
  const vertices = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1, -1,
     1,  1,
    -1,  1,
  ]);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // Get location of uResolution
  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uMappingScaleLoc = gl.getUniformLocation(program, 'uMappingScale');
  const uMappingRotationLoc = gl.getUniformLocation(program, 'uMappingRotation');
  const uMappingTranslationLoc = gl.getUniformLocation(program, 'uMappingTranslation');
  const uColorALoc = gl.getUniformLocation(program, "uColorA");
  const uColorBLoc = gl.getUniformLocation(program, "uColorB");


  function normalizeColor(rgb) {
    return rgb.map(v => v / 255.0);
  }

  // === Set Default Uniform Values ===
  const gui = new dat.GUI();

  const mapping = {
    scaleX: 0.45,
    scaleY: 5.5,
    rotation: 0.0,        // in radians
    translateX: 0.0,
    translateY: 0.0,
  };

  const colors = {
      colorA: [0.774, 0.370, 0.085],
      colorB: [0.088, 0.043, 0.023],
  };
  gui.add(mapping, 'scaleX', 0.01, 10).step(0.01).name('Scale X');
  gui.add(mapping, 'scaleY', 0.01, 10).step(0.01).name('Scale Y');
  gui.add(mapping, 'rotation', -Math.PI, Math.PI).step(0.01).name('Rotation');
  gui.add(mapping, 'translateX', -1.0, 1.0).step(0.01).name('Translate X');
  gui.add(mapping, 'translateY', -1.0, 1.0).step(0.01).name('Translate Y');

  gui.addColor(colors, 'colorA').name('Color A');
  gui.addColor(colors, 'colorB').name('Color B');


  // Animation loop
  function render() {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Background color
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2f(uResolution, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(uMappingScaleLoc, mapping.scaleX, mapping.scaleY);
    gl.uniform1f(uMappingRotationLoc, mapping.rotation);
    gl.uniform2f(uMappingTranslationLoc, mapping.translateX, mapping.translateY);
    gl.uniform3f(uColorALoc, ...normalizeColor(colors.colorA));
    gl.uniform3f(uColorBLoc, ...normalizeColor(colors.colorB));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
