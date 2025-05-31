precision mediump float;

// blender noise texture options
uniform vec2 uResolution;
uniform float uScale;
uniform float uDetail;
uniform float uRoughness;
uniform float uDistortion;

// parameters for first mapping node
uniform vec2 uMappingScale;
uniform float uMappingRotation;
uniform vec2 uMappingTranslation;

// generates pseudo random vectors
vec2 randomGradient(vec2 p) {
    float angle = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123) * 6.28318;
    return vec2(cos(angle), sin(angle));
}

// smoothstep function to fade values
float fade(float t) {
    return t * t * (3.0 - 2.0 * t);
}

// function for perlin noise
float perlinNoise(vec2 uv) {
    vec2 i0 = floor(uv);
    vec2 f0 = fract(uv);

    vec2 i1 = i0 + vec2(1.0, 0.0);
    vec2 i2 = i0 + vec2(0.0, 1.0);
    vec2 i3 = i0 + vec2(1.0, 1.0);

    vec2 g0 = randomGradient(i0);
    vec2 g1 = randomGradient(i1);
    vec2 g2 = randomGradient(i2);
    vec2 g3 = randomGradient(i3);

    float d0 = dot(g0, f0 - vec2(0.0, 0.0));
    float d1 = dot(g1, f0 - vec2(1.0, 0.0));
    float d2 = dot(g2, f0 - vec2(0.0, 1.0));
    float d3 = dot(g3, f0 - vec2(1.0, 1.0));

    float tx = fade(f0.x);
    float ty = fade(f0.y);

    float a = mix(d0, d1, tx);
    float b = mix(d2, d3, tx);
    return mix(a, b, ty);
}

// fbm function to represent blender noise texture, uses perlin noise 
float fbm(vec2 uv) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    int octaves = int(floor(uDetail));
    float remainder = fract(uDetail); // Blend fractional octave if needed

    for (int i = 0; i < 10; ++i) { // Max 10 octaves for safety
        if (i >= octaves) break;

        vec2 distortedUV = uv + uDistortion * vec2(
            perlinNoise(uv + vec2(1.7, 9.2)),
            perlinNoise(uv + vec2(8.3, 2.8))
        );

        value += amplitude * perlinNoise(distortedUV * frequency);
        frequency *= 2.0;
        amplitude *= uRoughness;
    }

    // Optional: Add final fractional octave
    if (remainder > 0.0) {
        vec2 distortedUV = uv + uDistortion * vec2(
            perlinNoise(uv + vec2(1.7, 9.2)),
            perlinNoise(uv + vec2(8.3, 2.8))
        );

        value += amplitude * remainder * perlinNoise(distortedUV * frequency);
    }

    return value;
}

// function to generate a voronoi pattenr
float voronoi(vec2 uv) {
    vec2 cell = floor(uv);
    vec2 fractUV = fract(uv);
    float minDist = 1.0;
    for(int j = -1; j <= 1; ++j) {
        for(int i = -1; i <= 1; ++i) {
            vec2 neighbor = vec2(float(i), float(j));
            vec2 point = randomGradient(cell + neighbor) * 0.5 + 0.5 + neighbor;
            float dist = length(fractUV - point);
            minDist = min(minDist, dist);
        }
    }
    return minDist;
}

// Function that applies transformations, like in blender
vec2 applyMapping(vec2 uv, vec2 scale, float rotation, vec2 translation) {
    // translation to the center
    uv -= 0.5;

    // scaling
    uv *= scale;

    // rotation, convert degrees to radians
    float cosR = cos(rotation);
    float sinR = sin(rotation);
    uv = mat2(cosR, -sinR, sinR, cosR) * uv;

    // translate back and add additional translation
    uv += 0.5 + translation;

    return uv;
}

void main() {
    // recreating a blender node setup in GLSL
    // get uv coordinates
    vec2 uv = gl_FragCoord.xy / uResolution.xy;

    // respresents mapping node from blender
    vec2 mappedUV = applyMapping(uv, uMappingScale, uMappingRotation, uMappingTranslation);

    // represents noise node from blender
    float n = fbm(mappedUV); // Noise result from mapped coordinates
    vec2 coord = mappedUV + n * uDistortion;

    // represents voronoi node from blender
    float v = voronoi(coord * uScale);  // Apply scale before Voronoi

    // Output 
    gl_FragColor = vec4(vec3(v), 1.0);
}
