import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loader = new GLTFLoader();
const buf = fs.readFileSync(path.resolve(__dirname, '../public/models/sg-male.glb'));
const gltf = await new Promise((resolve, reject) => {
  loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', resolve, reject);
});

const names = ['LeftArm', 'LeftForeArm', 'LeftShoulder', 'LeftUpLeg', 'LeftLeg', 'Spine2', 'Hips'];
for (const name of names) {
  let bone = null;
  gltf.scene.traverse((o) => { if (o.name === name) bone = o; });
  if (!bone || !bone.children.length) {
    console.log(name, 'no child');
    continue;
  }
  const child = bone.children[0];
  const local = child.position.clone();
  const abs = { x: Math.abs(local.x), y: Math.abs(local.y), z: Math.abs(local.z) };
  const axis = Object.entries(abs).sort((a, b) => b[1] - a[1])[0][0];
  console.log(name, '→ child', child.name, 'local', local.toArray().map((n) => +n.toFixed(3)), 'lengthAxis', axis);
}
