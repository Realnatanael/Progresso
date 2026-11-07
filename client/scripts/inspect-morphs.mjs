import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const files = ['sg-male.glb', 'sg-female.glb'];
const loader = new GLTFLoader();

function load(buf) {
  return new Promise((resolve, reject) => {
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', resolve, reject);
  });
}

for (const file of files) {
  const glbPath = path.resolve(__dirname, '../public/models', file);
  if (!fs.existsSync(glbPath)) {
    console.log(file, 'MISSING');
    continue;
  }
  const gltf = await load(fs.readFileSync(glbPath));
  console.log('\n===', file, '===');
  const morphs = new Set();
  const meshes = [];
  const bones = [];
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      const dict = o.morphTargetDictionary ? Object.keys(o.morphTargetDictionary) : [];
      meshes.push({ name: o.name, morphs: dict, verts: o.geometry?.attributes?.position?.count });
      dict.forEach((m) => morphs.add(m));
    }
    if (o.isBone || /Arm|Shoulder|ForeArm|Hand|Spine|Chest|UpLeg|Leg|Foot|Hip|Neck|Head/i.test(o.name)) {
      bones.push(o.name);
    }
  });
  console.log('unique morphs:', [...morphs]);
  console.log('meshes:', JSON.stringify(meshes, null, 2));
  console.log('bones:', [...new Set(bones)].sort().join(', '));
}
