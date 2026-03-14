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
    '    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),',
    '    u.y',
    '  );',
    '}',
    '',
    'float fbm(vec2 p) {',
    '  float value = 0.0;',
    '  float amplitude = 0.5;',
    '  for (int i = 0; i < 5; i++) {',
    '    value += amplitude * noise(p);',
    '    p = p * 2.02 + vec2(13.7, 9.2);',
    '    amplitude *= 0.5;',
    '  }',
    '  return value;',
    '}',
    '',
    'mat2 rotate2d(float angle) {',
    '  float s = sin(angle);',
    '  float c = cos(angle);',
    '  return mat2(c, -s, s, c);',
    '}',
    '',
    'float movingLine(vec2 p, float angle, float offset, float thickness, float blur, float speed, float warp) {',
    '  vec2 q = p * rotate2d(angle);',
    '  float drift = sin(q.x * 3.5 + speed) * warp;',
    '  drift += (fbm(vec2(q.x * 1.8, speed * 0.35)) - 0.5) * warp * 1.6;',
    '  float center = offset + drift;',
    '  float dist = abs(q.y - center);',
    '  float line = smoothstep(thickness + blur, thickness, dist);',
    '  float pulse = 0.35 + 0.65 * smoothstep(-1.0, 1.0, sin(speed * 1.7 + q.x * 1.2));',
    '  return line * pulse;',
    '}',
    '',
    'void main() {',
    '  vec2 uv = vUv;',
    '  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);',
    '  vec2 p = (uv - 0.5) * aspect;',
    '  float time = uTime * 0.32;',
    '',
    '  vec3 color = vec3(0.0);',
    '  float cyanLine = movingLine(p, 0.45, sin(time * 0.8) * 0.18, 0.006, 0.01, time + 0.2, 0.04);',
    '  float magentaLine = movingLine(p, -0.62, cos(time * 0.6 + 1.7) * 0.16, 0.005, 0.012, time + 1.9, 0.035);',
    '  float amberLine = movingLine(p, 1.05, sin(time * 0.5 + 3.1) * 0.14, 0.004, 0.01, time + 3.4, 0.03);',
    '  float ghostLine = movingLine(p, -1.2, cos(time * 0.7 + 0.4) * 0.22, 0.003, 0.014, time + 5.0, 0.025);',
    '',
    '  color += vec3(0.0, 0.92, 1.0) * cyanLine * 0.45;',
    '  color += vec3(1.0, 0.12, 0.45) * magentaLine * 0.38;',
    '  color += vec3(1.0, 0.7, 0.08) * amberLine * 0.28;',
    '  color += vec3(0.75, 0.2, 1.0) * ghostLine * 0.14;',
    '',
    '  color += vec3(0.7, 0.9, 1.0) * pow(cyanLine, 6.0) * 0.2;',
    '  color += vec3(1.0, 0.85, 0.9) * pow(magentaLine, 6.0) * 0.16;',
    '',
    '  float sparkleField = fbm(p * 14.0 + vec2(time * 0.8, -time * 0.5));',
    '  float sparkle = pow(max(sparkleField - 0.93, 0.0), 6.0) * 2.0;',
    '  color += vec3(1.0, 0.98, 0.94) * sparkle * 0.08;',
    '',
    '  float vignette = 1.0 - smoothstep(0.12, 1.05, length(p));',
    '  color *= 0.04 + vignette * 0.32;',
    '  color = clamp(color, 0.0, 1.0);',
    '  color = pow(color, vec3(0.92));',
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