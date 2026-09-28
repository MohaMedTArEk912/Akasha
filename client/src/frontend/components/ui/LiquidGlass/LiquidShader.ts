/**
 * Liquid Glass Shader Program — Inspired by dashersw/liquid-glass-js
 * 
 * Provides real-time optical refraction, chromatic aberration,
 * rim lighting, specular highlights, and shape SDFs (pill, circle, rounded rect).
 */

export const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texcoord;
  varying vec2 v_texcoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texcoord = a_texcoord;
  }
`;

export const FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D u_image;
  uniform vec2 u_resolution;
  uniform float u_borderRadius;
  uniform int u_shapeType; // 0: rounded, 1: pill, 2: circle
  uniform float u_edgeIntensity;
  uniform float u_rimIntensity;
  uniform float u_chromaticAberration;
  uniform vec4 u_tintColor;
  uniform float u_tintOpacity;
  uniform vec2 u_mousePos;
  uniform float u_specularIntensity;

  varying vec2 v_texcoord;

  // Signed distance function for rounded rectangle
  float roundedRectDistance(vec2 coord, vec2 size, float radius) {
    vec2 center = size * 0.5;
    vec2 pixelCoord = coord * size;
    vec2 d = abs(pixelCoord - center) - (center - radius);
    float outside = length(max(d, 0.0));
    float inside = min(max(d.x, d.y), 0.0);
    return outside + inside - radius;
  }

  // Signed distance function for circle
  float circleDistance(vec2 coord, vec2 size, float radius) {
    vec2 pixelCoord = coord * size;
    vec2 center = size * 0.5;
    return length(pixelCoord - center) - radius;
  }

  // Signed distance function for pill / capsule
  float pillDistance(vec2 coord, vec2 size, float radius) {
    vec2 center = size * 0.5;
    vec2 pixelCoord = coord * size;
    float halfAxis = max(0.0, (size.x * 0.5) - radius);
    vec2 clampedPos = pixelCoord - center;
    clampedPos.x = clamp(clampedPos.x, -halfAxis, halfAxis);
    return length(pixelCoord - (center + vec2(clampedPos.x, 0.0))) - radius;
  }

  float getDistance(vec2 coord, vec2 size, float radius, int shapeType) {
    if (shapeType == 1) {
      return pillDistance(coord, size, radius);
    } else if (shapeType == 2) {
      return circleDistance(coord, size, radius);
    } else {
      return roundedRectDistance(coord, size, radius);
    }
  }

  void main() {
    vec2 pixelCoord = v_texcoord * u_resolution;
    float dist = getDistance(v_texcoord, u_resolution, u_borderRadius, u_shapeType);

    // If outside the glass shape with anti-aliasing margin, discard or alpha 0
    if (dist > 1.0) {
      discard;
    }

    float alpha = 1.0 - smoothstep(-0.5, 0.5, dist);

    // Calculate normal from distance field gradients
    float eps = 1.5;
    float dx = getDistance((pixelCoord + vec2(eps, 0.0)) / u_resolution, u_resolution, u_borderRadius, u_shapeType) -
               getDistance((pixelCoord - vec2(eps, 0.0)) / u_resolution, u_resolution, u_borderRadius, u_shapeType);
    float dy = getDistance((pixelCoord + vec2(0.0, eps)) / u_resolution, u_resolution, u_borderRadius, u_shapeType) -
               getDistance((pixelCoord - vec2(0.0, eps)) / u_resolution, u_resolution, u_borderRadius, u_shapeType);
    vec2 normal = normalize(vec2(dx, dy) + 0.0001);

    // Edge proximity factor (0 at center, 1 near border)
    float edgeFactor = clamp(-dist / max(1.0, u_borderRadius * 0.5), 0.0, 1.0);
    float rimFactor = pow(1.0 - edgeFactor, 2.5);

    // Optical refraction offset
    vec2 refractionOffset = normal * (rimFactor * u_edgeIntensity);

    // Chromatic dispersion (RGB wavelength split)
    float ca = u_chromaticAberration * rimFactor;
    vec2 rCoord = clamp(v_texcoord - refractionOffset * (1.0 + ca), 0.0, 1.0);
    vec2 gCoord = clamp(v_texcoord - refractionOffset, 0.0, 1.0);
    vec2 bCoord = clamp(v_texcoord - refractionOffset * (1.0 - ca), 0.0, 1.0);

    float r = texture2D(u_image, rCoord).r;
    float g = texture2D(u_image, gCoord).g;
    float b = texture2D(u_image, bCoord).b;
    vec4 sceneColor = vec4(r, g, b, 1.0);

    // Specular highlight from light direction (top-left)
    vec2 lightDir = normalize(vec2(-0.4, -0.9));
    float specular = max(0.0, dot(-normal, lightDir));
    specular = pow(specular, 14.0) * u_specularIntensity * (0.6 + rimFactor * 0.4);

    // Top edge highlight strip
    float topEdge = smoothstep(0.0, 2.0, pixelCoord.y) * smoothstep(6.0, 2.0, pixelCoord.y);
    specular += topEdge * 0.15 * (1.0 - rimFactor);

    // Tint blend
    vec4 finalColor = mix(sceneColor, u_tintColor, u_tintOpacity);
    finalColor.rgb += vec3(specular + rimFactor * u_rimIntensity);

    gl_FragColor = vec4(finalColor.rgb, alpha);
  }
`;

export interface LiquidGlassUniforms {
  shapeType?: "rounded" | "pill" | "circle";
  borderRadius?: number;
  edgeIntensity?: number;
  rimIntensity?: number;
  chromaticAberration?: number;
  tintColor?: [number, number, number, number];
  tintOpacity?: number;
  specularIntensity?: number;
}
