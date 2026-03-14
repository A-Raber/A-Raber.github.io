(function () {
  var canvas;
  var gl;
  var program;
  var positionBuffer;
  var positionLocation;
  var resolutionLocation;
  var timeLocation;
  var startTime = 0;
  var vertexShaderSource = [
    'attribute vec2 aPosition;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPosition * 0.5 + 0.5;',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}'
  ].join('\n');

  var fragmentShaderSource = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform vec2 uResolution;',
    'uniform float uTime;',
    '',
    'float hash(vec2 p) {',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
    '}',
    '',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(',
    '    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),',
    '    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),',
    '    u.y',
    '  );',
    '}',
    '',
    'mat2 rotate2d(float angle) {',
    '  float s = sin(angle);',
    '  float c = cos(angle);',
    '  return mat2(c, -s, s, c);',
    '}',
    '',
    'void main() {',
    '  vec2 uv = vUv;',
    '  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);',
    '  vec2 p = (uv - 0.5) * aspect;',
    '',
    '  float radial = length(p);',
    '',
    '  vec2 warped = p * rotate2d(0.15 * uTime);',
    '  float layerA = noise(warped * 5.0 + vec2(uTime * 0.16, -uTime * 0.08));',
    '  float layerB = noise(warped * 9.0 - vec2(uTime * 0.11, uTime * 0.14));',
    '  float layerC = noise(p * 14.0 + vec2(-uTime * 0.2, uTime * 0.12));',
    '',
    '  float sweep = 0.5 + 0.5 * sin(8.0 * radial - uTime * 2.4 + layerA * 4.0);',
    '  float beam = 0.5 + 0.5 * cos((p.x * 8.0 - p.y * 4.0) + uTime * 1.7 + layerB * 5.0);',
    '  float coreGlow = exp(-6.8 * radial) * 0.26;',
    '  float sparkle = pow(max(layerC - 0.72, 0.0), 3.2) * 9.5;',
    '  float edgeFade = smoothstep(1.05, 0.12, radial);',
    '  float vignette = 1.0 - smoothstep(0.28, 1.08, radial);',
    '',
    '  vec3 cyan = vec3(0.02, 0.9, 1.0);',
    '  vec3 magenta = vec3(1.0, 0.06, 0.48);',
    '  vec3 amber = vec3(1.0, 0.72, 0.08);',
    '',
    '  vec3 color = vec3(0.0);',
    '  color += cyan * pow(layerA, 1.35) * 0.24;',
    '  color += magenta * pow(beam, 1.6) * 0.22;',
    '  color += amber * pow(sweep, 1.9) * 0.16;',
    '  color += mix(cyan, magenta, 0.5 + 0.5 * sin(uTime + radial * 10.0)) * coreGlow;',
    '  color += vec3(1.0, 0.98, 0.96) * sparkle;',
    '',
    '  color *= edgeFade;',
    '  color *= 0.14 + 0.86 * vignette;',
    '  color = clamp(color, 0.0, 1.0);',
    '  color = pow(color, vec3(0.82));',
    '',
    '  gl_FragColor = vec4(color, 1.0);',
    '}'
  ].join('\n');

  function main() {
    canvas = document.getElementById('webgl');
    gl = canvas.getContext('webgl');

    if (!gl) {
      console.error('WebGL is not available in this browser.');
      return;
    }

    program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) {
      return;
    }

    positionLocation = gl.getAttribLocation(program, 'aPosition');
    resolutionLocation = gl.getUniformLocation(program, 'uResolution');
    timeLocation = gl.getUniformLocation(program, 'uTime');

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
        1.0, -1.0,
        -1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        1.0, 1.0
      ]),
      gl.STATIC_DRAW
    );

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    startTime = performance.now();
    requestAnimationFrame(render);
  }

  function resizeCanvas() {
    var pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    var width = Math.floor(window.innerWidth * pixelRatio);
    var height = Math.floor(window.innerHeight * pixelRatio);

    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  function render(now) {
    var elapsed = (now - startTime) * 0.001;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, elapsed);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  function createProgram(context, vertexSource, fragmentSource) {
    var vertexShader = createShader(context, context.VERTEX_SHADER, vertexSource);
    var fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    var shaderProgram = context.createProgram();
    context.attachShader(shaderProgram, vertexShader);
    context.attachShader(shaderProgram, fragmentShader);
    context.linkProgram(shaderProgram);

    if (!context.getProgramParameter(shaderProgram, context.LINK_STATUS)) {
      console.error('Program link failed:', context.getProgramInfoLog(shaderProgram));
      context.deleteProgram(shaderProgram);
      return null;
    }

    return shaderProgram;
  }

  function createShader(context, type, source) {
    var shader = context.createShader(type);
    context.shaderSource(shader, source);
    context.compileShader(shader);

    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      console.error('Shader compile failed:', context.getShaderInfoLog(shader));
      context.deleteShader(shader);
      return null;
    }

    return shader;
  }

  window.addEventListener('load', main);
})();