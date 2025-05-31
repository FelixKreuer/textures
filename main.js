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
  const uScaleLoc = gl.getUniformLocation(program, 'uScale');
  const uDetailLoc = gl.getUniformLocation(program, 'uDetail');
  const uRoughnessLoc = gl.getUniformLocation(program, 'uRoughness');
  const uDistortionLoc = gl.getUniformLocation(program, 'uDistortion');
  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uMappingScaleLoc = gl.getUniformLocation(program, 'uMappingScale');
  const uMappingRotationLoc = gl.getUniformLocation(program, 'uMappingRotation');
  const uMappingTranslationLoc = gl.getUniformLocation(program, 'uMappingTranslation');

  // === Set Default Uniform Values ===
  const settings = {
    scale: 7.0,
    detail: 150.0,
    roughness: 0.8,
    distortion: 0.5,
  };
  const mapping = {
  scaleX: 0.45,
  scaleY: 5.5,
  rotation: 0.0,        // in radians
  translateX: 0.0,
  translateY: 0.0,
};

  // Animation loop
  function render() {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Background color
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Set the uResolution uniform
    gl.uniform1f(uScaleLoc, settings.scale);
    gl.uniform1f(uDetailLoc, settings.detail);
    gl.uniform1f(uRoughnessLoc, settings.roughness);
    gl.uniform1f(uDistortionLoc, settings.distortion);
    gl.uniform2f(uResolution, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(uMappingScaleLoc, mapping.scaleX, mapping.scaleY);
    gl.uniform1f(uMappingRotationLoc, mapping.rotation);
    gl.uniform2f(uMappingTranslationLoc, mapping.translateX, mapping.translateY);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
