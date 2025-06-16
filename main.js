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

  function resetValues() {
  Object.assign(mapping, defaultMapping);
  Object.assign(colors, defaultColors);

  // Needed to update GUI view
  for (let controller of gui.__controllers) {
    controller.updateDisplay();
  }
  for (let f of gui.__folders) {
    for (let controller of f.__controllers) {
      controller.updateDisplay();
    }
  }
}

  const defaultMapping = {
    scaleX: 0.45,
    scaleY: 5.5,
    rotation: 0.0,
    translateX: 0.0,
    translateY: 0.0,
  };

  const defaultColors = {
    colorA: [198, 94, 22],
    colorB: [22, 11, 6],
  };

  const mapping = {
    scaleX: 0.45,
    scaleY: 5.5,
    rotation: 0.0,        // in radians
    translateX: 0.0,
    translateY: 0.0,
  };

  const colors = {
    colorA: [198, 94, 22],
    colorB: [22, 11, 6],
  };
  const mappingFolder = gui.addFolder('Mapping');
  mappingFolder.add(mapping, 'scaleX', 0.01, 10).step(0.01);
  mappingFolder.add(mapping, 'scaleY', 0.01, 10).step(0.01);
  mappingFolder.add(mapping, 'rotation', -Math.PI, Math.PI).step(0.01);
  mappingFolder.add(mapping, 'translateX', -1.0, 1.0).step(0.01);
  mappingFolder.add(mapping, 'translateY', -1.0, 1.0).step(0.01);
  mappingFolder.open();

  const colorFolder = gui.addFolder('Colors');
  colorFolder.addColor(colors, 'colorA');
  colorFolder.addColor(colors, 'colorB');
  colorFolder.open();

  gui.add({ reset: resetValues }, 'reset').name('Reset');


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
