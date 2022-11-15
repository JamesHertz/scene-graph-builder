precision highp float;

varying vec3 fNormal;

uniform vec3 uColor;
void main() {
   // float aux = dot(fNormal, vec3(1, 0, 0));//vec3(fNormal.x * .6 + .4, 0, 0);
   // gl_FragColor = vec4(aux ,0, 0, 1);
   gl_FragColor = vec4(fNormal, 1);
}