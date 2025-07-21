const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });

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
  const uMappingTranslationLoc = gl.getUniformLocation(program, 'uMappingTranslation');
  const uColorALoc = gl.getUniformLocation(program, "uColorA");
  const uColorBLoc = gl.getUniformLocation(program, "uColorB");
  const uWaveScale = gl.getUniformLocation(program, 'uWaveScale');
  const uWaveDistortion = gl.getUniformLocation(program, 'uWaveDistortion');
  const uWaveDetailScale = gl.getUniformLocation(program, 'uWaveDetailScale');
  const uKnotPos = gl.getUniformLocation(program, 'uKnotPos');
  const uKnotTwist = gl.getUniformLocation(program, 'uKnotTwist');
  const uKnotPinch = gl.getUniformLocation(program, 'uKnotPinch');
  const uKnotInnerDetailScale = gl.getUniformLocation(program, 'uKnotInnerDetailScale');
  const uKnotDistortIrregularity = gl.getUniformLocation(program, 'uKnotDistortIrregularity');
  const uKnotDistortFrequency = gl.getUniformLocation(program, 'uKnotDistortFrequency');
  const uKnotDistortDetail = gl.getUniformLocation(program, 'uKnotDistortDetail');
  const uKnotEnabled = gl.getUniformLocation(program, 'uKnotEnabled');


  function normaliseColor(rgb) {
    return rgb.map(v => v / 255.0);
  }

  // === Set Default Uniform Values ===
  const gui = new dat.GUI();

  function resetValues() {
    Object.assign(mapping, defaultMapping);
    Object.assign(colors, defaultColors);
    Object.assign(wave, defaultWave);

    // Needed to update GUI view
    for (let controller of gui.__controllers) {
      controller.updateDisplay();
    }
    // Update controllers in folders
    Object.values(gui.__folders || {}).forEach(folder => {
      folder.__controllers.forEach(controller => {
        controller.updateDisplay();
      });
    });
  }

  const defaultMapping = {
    scaleX: 0.4,
    scaleY: 3.3,
    translateX: 0.0,
    translateY: 0.0,
    knotPosX: 0.5,
    knotPosY: 0.5,
    knotTwist: 3,
    knotPinch: 0.5, // New pinch parameter
    knotInnerDetailScale: 7.37, // Scale for inner rings detail
    canvasWidth: 640,//window.innerWidth || 1280,
    canvasHeight: 640,//window.innerHeight || 640,
    knotDistortIrregularity: 0.5,
    knotDistortFrequency: 0.5,
    knotDistortDetail: 0.5,
    knotEnabled: true,
  };

  const defaultColors = {
    colorA: [210,158,111],
    colorB: [100,47,29],
  };

  const mapping = {
    ...defaultMapping
  };

  const colors = {
    ...defaultColors
  };

  const defaultWave = {
    scale: 10.0,
    distortion: 50.0,
    detailScale: 0.01,
  };

  const wave = { ...defaultWave };

  const canvasFolder = gui.addFolder('Image Size');
  canvasFolder.add(mapping, 'canvasWidth', 100, 4096).step(1).name('Width').onChange(updateCanvasSize);
  canvasFolder.add(mapping, 'canvasHeight', 100, 4096).step(1).name('Height').onChange(updateCanvasSize);
  canvasFolder.open();

  const colorFolder = gui.addFolder('Colors');
  colorFolder.addColor(colors, 'colorA').name('Base Color');
  colorFolder.addColor(colors, 'colorB').name('Ring Color');
  colorFolder.open();

  const mappingFolder = gui.addFolder('Transformation');
  mappingFolder.add(mapping, 'scaleX', 0.4, 1.2).step(0.01).name('Scale X');
  mappingFolder.add(mapping, 'scaleY', 3.3, 6).step(0.01).name('Scale Y');
  mappingFolder.add(mapping, 'translateX', -5.0, 5.0).step(0.01).name('Translate X');
  mappingFolder.add(mapping, 'translateY', -5.0, 5.0).step(0.01).name('Translate Y');
  mappingFolder.open();


  const waveFolder = gui.addFolder("Growth Ring Options");
  waveFolder.add(wave, 'scale', 6.0, 15.0).name('Scale');
  waveFolder.add(wave, 'distortion', 30.0, 60.0).name('Distortion');
  waveFolder.add(wave, 'detailScale', 0.01, 0.2).step(0.001).name('Detail Scale');
  waveFolder.open();

  const knotFolder = gui.addFolder('Knot');
  knotFolder.add(mapping, 'knotEnabled').name('Enable Knot');
  knotFolder.add(mapping, 'knotPosX', 0.0, 1.0).step(0.01).name('Knot Pos X');
  knotFolder.add(mapping, 'knotPosY', 0.0, 1.0).step(0.01).name('Knot Pos Y');
  knotFolder.add(mapping, 'knotTwist', -Math.PI * 2, Math.PI * 2).step(0.01).name('Knot Twist');
  knotFolder.add(mapping, 'knotPinch', 0.0, 1.0).step(0.01).name('Knot Size');
  knotFolder.add(mapping, 'knotDistortIrregularity', 0.0, 5.0).step(0.01).name('Irregularity');
  knotFolder.add(mapping, 'knotDistortFrequency', 0.0, 5.0).step(0.01).name('Frequency');
  knotFolder.add(mapping, 'knotDistortDetail', 0.0, 5.0).step(0.01).name('Detail');
  knotFolder.open();

  const knotInnerFolder = gui.addFolder('Knot Inner Rings');
  knotInnerFolder.add(mapping, 'knotInnerDetailScale', 0.0, 10.0).step(0.01).name('Ring Distortion');
  knotInnerFolder.open();

  
  function updateCanvasSize() {
    canvas.width = mapping.canvasWidth;
    canvas.height = mapping.canvasHeight;
  }
  gui.add({ reset: resetValues }, 'reset').name('Reset');


  // Animation loop
  function render() {
    updateCanvasSize(); // Ensure canvas size is updated
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Background color
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2f(uResolution, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(uMappingScaleLoc, mapping.scaleX, mapping.scaleY);
    gl.uniform2f(uMappingTranslationLoc, mapping.translateX, mapping.translateY);
    gl.uniform3f(uColorALoc, ...normaliseColor(colors.colorA));
    gl.uniform3f(uColorBLoc, ...normaliseColor(colors.colorB));

    gl.uniform1f(uWaveScale, wave.scale);
    gl.uniform1f(uWaveDistortion, wave.distortion);
    gl.uniform1f(uWaveDetailScale, wave.detailScale);

    gl.uniform2f(uKnotPos, mapping.knotPosX, mapping.knotPosY);
    gl.uniform1f(uKnotTwist, mapping.knotTwist);
    gl.uniform1f(uKnotPinch, mapping.knotPinch); // Set the pinch amount

    gl.uniform1f(uKnotInnerDetailScale, mapping.knotInnerDetailScale);

    gl.uniform1f(uKnotDistortIrregularity, mapping.knotDistortIrregularity);
    gl.uniform1f(uKnotDistortFrequency, mapping.knotDistortFrequency);
    gl.uniform1f(uKnotDistortDetail, mapping.knotDistortDetail);
    gl.uniform1i(uKnotEnabled, mapping.knotEnabled ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
