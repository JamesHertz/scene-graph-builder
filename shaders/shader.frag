precision highp float;

varying vec3 fNormal;

uniform vec3 uColor;


varying vec3 fColor;
void main() {
   // https://math.hws.edu/graphicsbook/c7/s2.html
   // we got a formula right here and we decided 
   // to apply it to the work
   vec3 N = normalize(fNormal);
   gl_FragColor = vec4(uColor * N.z, 1);
}