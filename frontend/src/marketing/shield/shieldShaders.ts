/**
 * Adapted from cortiz2894/flow-shield-effect (see tools/vault-images/NOTICE.md).
 * Purple storm preset for 4626 marketing vault hero.
 */
import * as THREE from 'three'

export const SHIELD_MAX_HITS = 4

export const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vObjPos;

  void main() {
    vObjPos  = position;
    vNormal  = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`

export const fragmentShader = /* glsl */ `
  #define MAX_HITS 4

  uniform float uTime;
  uniform vec3  uColor;
  uniform float uLife;
  uniform float uHexScale;
  uniform float uEdgeWidth;
  uniform float uFresnelPower;
  uniform float uFresnelStrength;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uFlashSpeed;
  uniform float uFlashIntensity;
  uniform float uNoiseScale;
  uniform vec3  uNoiseEdgeColor;
  uniform float uNoiseEdgeWidth;
  uniform float uNoiseEdgeIntensity;
  uniform float uNoiseEdgeSmoothness;
  uniform float uHexOpacity;
  uniform float uShowHex;
  uniform float uFlowScale;
  uniform float uFlowSpeed;
  uniform float uFlowIntensity;
  uniform vec3  uHitPos[MAX_HITS];
  uniform float uHitTime[MAX_HITS];
  uniform float uHitRingSpeed;
  uniform float uHitRingWidth;
  uniform float uHitMaxRadius;
  uniform float uHitDuration;
  uniform float uHitIntensity;
  uniform float uHitImpactRadius;
  uniform float uFadeStart;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vObjPos;

  vec3 mod289v3(vec3 x){ return x - floor(x*(1./289.))*289.; }
  vec4 mod289v4(vec4 x){ return x - floor(x*(1./289.))*289.; }
  vec4 permute(vec4 x){ return mod289v4(((x*34.)+1.)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }

  float snoise(vec3 v){
    const vec2 C = vec2(1./6., 1./3.);
    const vec4 D = vec4(0., 0.5, 1., 2.);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1. - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289v3(i);
    vec4 p = permute(permute(permute(
      i.z+vec4(0.,i1.z,i2.z,1.))
     +i.y+vec4(0.,i1.y,i2.y,1.))
     +i.x+vec4(0.,i1.x,i2.x,1.));
    float n_ = 0.142857142857;
    vec3  ns = n_*D.wyz - D.xzx;
    vec4 j   = p - 49.*floor(p*ns.z*ns.z);
    vec4 x_  = floor(j*ns.z);
    vec4 y_  = floor(j - 7.*x_);
    vec4 x   = x_*ns.x + ns.yyyy;
    vec4 y   = y_*ns.x + ns.yyyy;
    vec4 h   = 1. - abs(x) - abs(y);
    vec4 b0  = vec4(x.xy, y.xy);
    vec4 b1  = vec4(x.zw, y.zw);
    vec4 s0  = floor(b0)*2.+1.;
    vec4 s1  = floor(b1)*2.+1.;
    vec4 sh  = -step(h, vec4(0.));
    vec4 a0  = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1  = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0  = vec3(a0.xy, h.x);
    vec3 p1  = vec3(a0.zw, h.y);
    vec3 p2  = vec3(a1.xy, h.z);
    vec3 p3  = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m = max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m = m*m;
    return 42.*dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  vec3 lifeColor(float life){
    return mix(vec3(0.35, 0.08, 0.55), uColor, life);
  }

  float hexPattern(vec2 p){
    p *= uHexScale;
    const vec2 s = vec2(1., 1.7320508);
    vec4 hC = floor(vec4(p, p-vec2(0.5,1.))/s.xyxy) + 0.5;
    vec4 h  = vec4(p-hC.xy*s, p-(hC.zw+0.5)*s);
    vec2 cell = (dot(h.xy,h.xy) < dot(h.zw,h.zw)) ? h.xy : h.zw;
    cell = abs(cell);
    float d = max(dot(cell, s*0.5), cell.x);
    return smoothstep(0.5-uEdgeWidth, 0.5, d);
  }

  void main(){
    float noise = snoise(vObjPos * uNoiseScale) * 0.5 + 0.5;
    float revealMask = smoothstep(uReveal - uNoiseEdgeWidth, uReveal, noise);
    if (revealMask < 0.001) discard;

    float fresnel = pow(1.0 - dot(vNormal, vViewDir), uFresnelPower) * uFresnelStrength;
    float t = uTime * uFlowSpeed;
    float fn1 = snoise(vObjPos*uFlowScale + vec3(t, t*0.6, t*0.4));
    float flowNoise = fn1 * 0.5 + 0.5;

    vec3 absN = abs(normalize(vObjPos));
    float hexFade = smoothstep(0.65, 0.85, max(absN.x, max(absN.y, absN.z)));
    vec2 faceUV = absN.x >= absN.y && absN.x >= absN.z ? vObjPos.yz : (absN.y >= absN.z ? vObjPos.xz : vObjPos.xy);
    float hex = hexPattern(faceUV) * hexFade * uShowHex;

    vec3 normPos = normalize(vObjPos);
    float ringContrib = 0.0;
    for (int i = 0; i < MAX_HITS; i++) {
      float ht = uHitTime[i];
      float elapsed = uTime - ht;
      float isActive = step(0.0, ht) * step(0.0, elapsed) * step(elapsed, uHitDuration);
      float dist = acos(clamp(dot(normPos, normalize(uHitPos[i])), -1.0, 1.0));
      float ringR = min(elapsed * uHitRingSpeed, uHitMaxRadius);
      float ring = smoothstep(uHitRingWidth, 0.0, abs(dist - ringR));
      float fade = 1.0 - smoothstep(uHitDuration*0.5, uHitDuration, elapsed);
      ringContrib += ring * fade * isActive;
    }

    vec3 lColor = lifeColor(uLife);
    float intensity = hex * uHexOpacity * (0.3 + fresnel*0.7) + fresnel*0.45;
    vec3 shieldColor = lColor * intensity * 2.0 + lColor * flowNoise * fresnel * uFlowIntensity * 0.35;
    shieldColor += lColor * ringContrib * uHitIntensity;
    float alpha = clamp(intensity * uOpacity * revealMask, 0.0, 1.0);
    gl_FragColor = vec4(shieldColor, alpha);
  }
`

export function createShieldMaterial(): THREE.ShaderMaterial {
  const hitPositions = Array.from({ length: SHIELD_MAX_HITS }, () => new THREE.Vector3(0, 1, 0))
  const hitTimes = new Array(SHIELD_MAX_HITS).fill(-999)

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#8b5cf6') },
      uLife: { value: 1 },
      uHexScale: { value: 2.8 },
      uEdgeWidth: { value: 0.07 },
      uFresnelPower: { value: 2.0 },
      uFresnelStrength: { value: 1.6 },
      uOpacity: { value: 0.42 },
      uReveal: { value: 1 },
      uFlashSpeed: { value: 0.5 },
      uFlashIntensity: { value: 0.08 },
      uNoiseScale: { value: 1.1 },
      uNoiseEdgeColor: { value: new THREE.Color('#a78bfa') },
      uNoiseEdgeWidth: { value: 0.02 },
      uNoiseEdgeIntensity: { value: 4 },
      uNoiseEdgeSmoothness: { value: 0.5 },
      uHexOpacity: { value: 0.08 },
      uShowHex: { value: 0.6 },
      uFlowScale: { value: 2.2 },
      uFlowSpeed: { value: 0.9 },
      uFlowIntensity: { value: 2.5 },
      uHitPos: { value: hitPositions },
      uHitTime: { value: hitTimes },
      uHitRingSpeed: { value: 1.4 },
      uHitRingWidth: { value: 0.14 },
      uHitMaxRadius: { value: 1.0 },
      uHitDuration: { value: 1.2 },
      uHitIntensity: { value: 3.2 },
      uHitImpactRadius: { value: 0.35 },
      uFadeStart: { value: -0.2 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}
