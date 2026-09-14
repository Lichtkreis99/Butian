export const PLANETARIUM_PROJECTION_GLSL = `
  uniform float planetariumMode;
  uniform float planetariumProjection;
  uniform float planetariumFov;
  uniform float planetariumAspect;

  vec4 planetariumProject(vec3 cameraPosition) {
    vec3 direction = normalize(cameraPosition);
    float forward = -direction.z;
    float halfFov = radians(planetariumFov * 0.5);
    vec2 projected;
    if (planetariumProjection < 1.5) {
      float scale = tan(halfFov * 0.5);
      projected = direction.xy / max(0.000001, 1.0 + forward) / scale;
    } else {
      float theta = acos(clamp(forward, -1.0, 1.0));
      projected = normalize(direction.xy) * theta / halfFov;
    }
    projected.x /= planetariumAspect;
    return vec4(projected, 0.0, 1.0);
  }
`;
