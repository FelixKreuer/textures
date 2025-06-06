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
float fbm(vec2 uv, float scale, float detail, float roughness, float distortion) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = scale;

    int octaves = int(floor(detail));
    float remainder = fract(detail);

    for (int i = 0; i < 10; ++i) {
        if (i >= octaves) break;

        vec2 distortionOffset = distortion * vec2(
            //semi random offsets, usually takes completly random values, not needed for this purpose
            perlinNoise(uv + vec2(1.3, 7.2)),
            perlinNoise(uv + vec2(5.9, 2.5))
        );

        value += amplitude * perlinNoise((uv + distortionOffset) * frequency);
        frequency *= 2.0;
        amplitude *= roughness;
    }

    if (remainder > 0.0) {
        vec2 distortionOffset = distortion * vec2(
            perlinNoise(uv + vec2(1.3, 7.2)),
            perlinNoise(uv + vec2(5.9, 2.5))
        );

        value += amplitude * remainder * perlinNoise((uv + distortionOffset) * frequency);
    }

    return value;
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

void main() {
    // this part is used to create the basic wood texture
    // get uv coordinates
    vec2 uv = gl_FragCoord.xy / uResolution.xy;

    // respresents mapping node from blender
    vec2 mappedUV = applyMapping(uv, uMappingScale, uMappingRotation, uMappingTranslation);

    float noiseA = fbm(mappedUV, 5.5, 10.0, 0.8, 4.0);
    float voronoiA = voronoi(mappedUV + noiseA, 2.1, 0.0);

    float noiseB = fbm(mappedUV, 7.0, 10.0, 0.8, 0.5);
    float voronoiB = voronoi(mappedUV + noiseB, 2.5, 4.2);

    // Mix (darken mode: min)
    float final = min(voronoiA, voronoiB);
    //float gray = grayscaleColorRamp(final, 0.173, 0.732);
    float gray = grayscaleColorRamp(final, 0.0, 1.0);
    vec3 color = mixColor(gray, uColorA, uColorB);

    // this part is used to add knots to the wood texture
    /* TODO */
    // Output
    gl_FragColor = vec4(color, 1.0);
}
