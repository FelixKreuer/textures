precision mediump float;

// blender noise texture options
uniform vec2 uResolution;

// parameters for first mapping node
uniform vec2 uMappingScale;
uniform float uMappingRotation;
uniform vec2 uMappingTranslation;

// parameters for the final color
uniform vec3 uColorA;
uniform vec3 uColorB;

// wave texture parameters
uniform float uWaveScale;
uniform float uWaveDistortion;
uniform float uWaveDetail;
uniform float uWaveDetailScale;
uniform float uWaveDetailRoughness;


// struct to represent color stops in a color ramp
struct ColorStop {
    float position; // from 0.0 to 1.0
    vec3 color;     // RGB
};
// used to interpolate between two colors
vec3 evaluateColorRamp(float t, ColorStop stopA, ColorStop stopB) {
    // Clamp the input value to [0, 1]
    t = clamp(t, 0.0, 1.0);

    // Normalize t between stopA.position and stopB.position
    float range = stopB.position - stopA.position;
    float localT = (t - stopA.position) / range;

    // Clamp again in case t is outside the two stop range
    localT = clamp(localT, 0.0, 1.0);

    // Linear interpolation between stopA.color and stopB.color
    return mix(stopA.color, stopB.color, localT);
}

// used to create a grayscale ramp, similar to blender color ramp node with only black and white
float grayscaleColorRamp(float t, float stopA, float stopB) {
    // clamp stops to [0, 1], should not be needed, but just in case
    stopA = clamp(stopA, 0.0, 1.0);
    stopB = clamp(stopB, 0.0, 1.0);

    // inverted or equal stops
    if (stopA >= stopB) {
        return t < stopA ? 0.0 : 1.0;
    }

    // interpolate between black and white
    return clamp((t - stopA) / (stopB - stopA), 0.0, 1.0);
}

// used to mix two colors, similar to blender mix node
vec3 mixColor(float fac, vec3 color1, vec3 color2) {
    return mix(color1, color2, fac);
}


// generates pseudo random vectors
vec2 randomGradient(vec2 p) {
    float angle = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123) * 6.28318;
    return vec2(cos(angle), sin(angle));
}
vec2 randomVec2Offset(float seed) {
    return vec2(
        sin(seed * 12.9898 + 78.233) * 43758.5453,
        cos(seed * 26.6511 + 34.196) * 24634.6345
    );
}
float hash(vec2 p) {
    return fract(sin(dot(p ,vec2(127.1, 311.7))) * 43758.5453123);
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
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Four corners of the cell
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    // Smooth interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// fbm function to represent blender noise texture, uses perlin noise 
float fbm(vec2 co, float scale, float detail, float roughness , float distortion) {
    vec2 p = co;
    p *= scale; // scale the coordinates
    if (distortion != 0.0) {
        vec2 offsetX = randomVec2Offset(0.0);
        vec2 offsetY = randomVec2Offset(1.0);

        p += vec2(
            noise(p + offsetX) * distortion,
            noise(p + offsetY) * distortion
        );
    }

    float fscale = 1.0;
    float amp = 1.0;
    float maxAmp = 0.0;
    float sum = 0.0;

    int octaves = int(floor(detail));
    // GLSL requires loop bounds to be constant, so use a fixed max and break
    const int MAX_OCTAVES = 15;
    for (int i = 0; i < MAX_OCTAVES; ++i) {
        if (i >= octaves) break;
        float t = noise(p * fscale);
        sum += t * amp;
        maxAmp += amp;
        amp *= roughness;
        fscale *= 2.0;
    }

    float rmd = fract(detail);
    if (rmd != 0.0) {
        float t = noise(p * fscale);
        sum += t * amp * rmd;
        maxAmp += amp * rmd;
    }

    // Normalize to [0, 1]
    return 0.5 * (sum / maxAmp) + 0.5;
}


// generates a single octave of voronoi
float voronoiSingle(vec2 uv) {
    vec2 cell = floor(uv); // get the cell coordinates
    vec2 fractUV = fract(uv); // remainder of uv coordinates, position within the cell
    float minDist = 1.0;
    // creates a grid around the cell, places pseudo random points in every cell, returns the shortest distance to a point
    for (int j = -1; j <= 1; ++j) {
        for (int i = -1; i <= 1; ++i) {
            vec2 neighbor = vec2(float(i), float(j));
            vec2 point = randomGradient(cell + neighbor) * 0.5 + 0.5 + neighbor;
            float dist = length(fractUV - point);
            minDist = min(minDist, dist);
        }
    }
    return minDist;
}

// voronoi function that generates multiple octaves of voronoi noise, similar to blender voronoi node
float voronoi(vec2 uv, float scale, float detail) {
    uv *= scale;

    int octaves = int(floor(detail));
    float remainder = fract(detail);

    float result = 0.0;
    float amplitude = 1.0; // how much an octave contributes
    float frequency = 1.0; // how much an octave is zoomed in
    float totalAmplitude = 0.0; //keeps track of all amplitudes to normalise the result
    // go through every octave, consecutive octaves have double frequency and half amplitude
    for (int i = 0; i < 10; ++i) {
        if (i >= octaves) break;

        result += voronoiSingle(uv * frequency) * amplitude;
        totalAmplitude += amplitude;

        amplitude *= 0.5;
        frequency *= 2.0;
    }
    // if there is a fractional octave, add it
    if (remainder > 0.0) {
        float last = voronoiSingle(uv * frequency);
        result += last * amplitude * remainder;
        totalAmplitude += amplitude * remainder;
    }

    // normalise
    return result / totalAmplitude;
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

float wave(vec2 uv, float scale, float distortion, float detail, float detailScale, float detailRoughness) {
    // apply scale
    uv *= scale;
    float n;
    n = uv.x * 20.0;
    if (distortion != 0.0) {
        n += distortion * (fbm(uv * detailScale, 1.0, detail, detailRoughness, 0.0) * 2.0 - 1.0);
    }
    
    return 0.5 + 0.5 * sin(n - 6.2831853);
}

void main() {
    // this part is used to create the basic wood texture
    // get uv coordinates
    vec2 uv = gl_FragCoord.xy / uResolution.xy;

    // respresents mapping node from blender
    vec2 mappedUV = applyMapping(uv, uMappingScale, uMappingRotation, uMappingTranslation);
    float x = fbm(mappedUV, uWaveScale, uWaveDetail, uWaveDetailScale, uWaveDistortion);
    x = wave(mappedUV, uWaveScale, uWaveDistortion, uWaveDetail, uWaveDetailScale, uWaveDetailRoughness);

    /* float noiseA = fbm(mappedUV, 5.5, 10.0, 0.8, 4.0);
    float voronoiA = voronoi(mappedUV + noiseA, 2.1, 0.0);

    float noiseB = fbm(mappedUV, 7.0, 10.0, 0.8, 0.5);
    float voronoiB = voronoi(mappedUV + noiseB, 2.5, 4.2);

    // Mix (darken mode: min)
    float final = min(voronoiA, voronoiB);
    //float gray = grayscaleColorRamp(final, 0.173, 0.732);
    
    // knot generation, simple ring pattern WIP
    vec3 knotColor = uColorB;  // darker color
    float knotMask = 0.0;

    // knot center position TODO pseudo-randomize this
    vec2 knotCenter = vec2(0.4, 0.6);

    // distance from UV to the knot center
    float dist = distance(uv, knotCenter);

    // generate ring pattern using sine function
    float ringPattern = 0.5 + 0.5 * sin(40.0 * dist - 3.0); // 40 = ring frequency, 3 = phase offset

    // falloff mask to fade rings outward
    float falloff = smoothstep(0.1, 0.05, dist); // from radius 0.1 to 0.05 fadeout

    // final knot mask
    knotMask = ringPattern * falloff;
    
    // blend into main wood texture
    color = mix(color, knotColor, knotMask * 0.8); // 0.8 = strength*/
    vec3 color = mixColor(x, uColorA, uColorB);

    // Output
    gl_FragColor = vec4(color, 1.0);
}
