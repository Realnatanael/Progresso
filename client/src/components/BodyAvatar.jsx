import { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

useGLTF.preload('/models/sg-male.glb');
useGLTF.preload('/models/sg-female.glb');

/** Bumpe quando pose/morph local mudar, para reclonar o skeleton no HMR. */
const STANCE_REV = 18;
/** Altura de referência do male youth Shot Generator (metros). */
const SG_MALE_HEIGHT_M = 1.6;

/** Morphs globais via treino (definition) + IMC (volume). Sem troca de “skin”. */
function morphWeights(definition = 0, volume = 0) {
  const d = Math.min(1, Math.max(0, definition));
  const v = Math.min(1, Math.max(0, volume));
  return {
    Skinny: (1 - d) * (1 - v),
    Muscular: d * (1 - v * 0.45),
    Obese: v * (1 - d * 0.35),
  };
}

/** A-pose Mixamo → postura de sentido (braços colados ao tronco). */
function applyAttentionStance(root) {
  const bones = new Map();
  root.traverse((obj) => {
    if (obj.name) bones.set(obj.name, obj);
  });

  const deg = THREE.MathUtils.degToRad;
  const leftArm = bones.get('LeftArm');
  const rightArm = bones.get('RightArm');
  const leftFore = bones.get('LeftForeArm');
  const rightFore = bones.get('RightForeArm');

  // Neste skeleton o eixo que fecha o braço é X (não Z).
  if (leftArm) {
    leftArm.rotateX(deg(41));
    leftArm.rotateZ(deg(-6));
  }
  if (rightArm) {
    rightArm.rotateX(deg(41));
    rightArm.rotateZ(deg(6));
  }

  // leve flexão no cotovelo, sem abrir a mão pra fora
  if (leftFore) leftFore.rotateZ(deg(-8));
  if (rightFore) rightFore.rotateZ(deg(8));

  root.updateMatrixWorld(true);
}

function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

function boneLength(bone) {
  const child = bone?.children?.[0];
  return child ? child.position.length() : 0.23;
}

function smoothstep(edge0, edge1, x) {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Morphs locais no bind pose:
 * - braço / antebraço: radial no meio do osso
 * - ombro: volume só na lateral (deltóide)
 * - peitoral: placa frontal (quase quadrada) + fenda no esterno
 */
function prepareMuscleData(root) {
  const tmp = new THREE.Vector3();
  const boneSpace = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const pushDir = new THREE.Vector3();
  const meshFromBone = new THREE.Matrix4();
  const invBind = new THREE.Matrix4();

  root.traverse((obj) => {
    if (!obj.isSkinnedMesh || obj.userData.muscleReady) return;
    const name = (obj.name || '').toLowerCase();
    if (name.includes('lod') && !name.includes('lod0')) return;

    const geo = obj.geometry;
    const pos = geo?.attributes?.position;
    const skinIndex = geo?.attributes?.skinIndex;
    const skinWeight = geo?.attributes?.skinWeight;
    if (!pos || !skinIndex || !skinWeight || !obj.skeleton) return;

    const skeleton = obj.skeleton;
    const leftArm = skeleton.bones.findIndex((b) => b.name === 'LeftArm');
    const rightArm = skeleton.bones.findIndex((b) => b.name === 'RightArm');
    const leftFore = skeleton.bones.findIndex((b) => b.name === 'LeftForeArm');
    const rightFore = skeleton.bones.findIndex((b) => b.name === 'RightForeArm');
    const leftShoulder = skeleton.bones.findIndex((b) => b.name === 'LeftShoulder');
    const rightShoulder = skeleton.bones.findIndex((b) => b.name === 'RightShoulder');
    const spine = skeleton.bones.findIndex((b) => b.name === 'Spine');
    const spine1 = skeleton.bones.findIndex((b) => b.name === 'Spine1');
    const spine2 = skeleton.bones.findIndex((b) => b.name === 'Spine2');
    if (leftArm < 0 && rightArm < 0 && spine2 < 0 && spine1 < 0) return;

    invBind.copy(obj.bindMatrix).invert();

    const count = pos.count;
    const bindPos = new Float32Array(pos.array);
    const armDeltas = new Float32Array(count * 3);
    const forearmDeltas = new Float32Array(count * 3);
    const shoulderDeltas = new Float32Array(count * 3);
    const chestDeltas = new Float32Array(count * 3);
    // Volume local suave sobre o morph global do treino
    const armPush = 0.018;
    const forearmPush = 0.014;
    const shoulderPush = 0.02;
    // Peitoral definido (lean): pouco volume pra frente, fenda estreita, só no peito alto
    const chestPush = 0.012;
    const chestCleft = 0.0022;
    const chestBoneIdx = spine2 >= 0 ? spine2 : spine1;

    for (let i = 0; i < count; i += 1) {
      let wLeftArm = 0;
      let wRightArm = 0;
      let wLeftFore = 0;
      let wRightFore = 0;
      let wLeftSh = 0;
      let wRightSh = 0;
      let wSpine = 0;
      let wSpine1 = 0;
      let wSpine2 = 0;
      for (let k = 0; k < 4; k += 1) {
        const idx = skinIndex.getComponent(i, k);
        const w = skinWeight.getComponent(i, k);
        if (idx === leftArm) wLeftArm += w;
        if (idx === rightArm) wRightArm += w;
        if (idx === leftFore) wLeftFore += w;
        if (idx === rightFore) wRightFore += w;
        if (idx === leftShoulder) wLeftSh += w;
        if (idx === rightShoulder) wRightSh += w;
        if (idx === spine) wSpine += w;
        if (idx === spine1) wSpine1 += w;
        if (idx === spine2) wSpine2 += w;
      }

      const armSkin = Math.max(wLeftArm, wRightArm);
      const foreSkin = Math.max(wLeftFore, wRightFore);
      const shSkin = Math.max(wLeftSh, wRightSh);
      const spineSkin = wSpine2 * 1.15 + wSpine1 + wSpine * 0.35;
      const isLeft = (wLeftArm + wLeftFore + wLeftSh) >= (wRightArm + wRightFore + wRightSh);
      const armBoneIdx = isLeft ? leftArm : rightArm;
      const foreBoneIdx = isLeft ? leftFore : rightFore;
      const shBoneIdx = isLeft ? leftShoulder : rightShoulder;

      tmp.fromBufferAttribute(pos, i);

      // —— Braço: radial no meio ——
      if (armBoneIdx >= 0 && armSkin >= 0.18) {
        boneSpace.copy(tmp).applyMatrix4(obj.bindMatrix).applyMatrix4(skeleton.boneInverses[armBoneIdx]);
        const armLen = boneLength(skeleton.bones[armBoneIdx]) || 0.23;
        const along = THREE.MathUtils.clamp(boneSpace.y / armLen, 0, 1);
        const belly = Math.exp(-(((along - 0.44) / 0.2) ** 2));
        const influence = armSkin * belly;
        if (influence >= 0.03) {
          radial.set(boneSpace.x, 0, boneSpace.z);
          if (radial.lengthSq() > 1e-8) {
            radial.normalize();
            meshFromBone.copy(skeleton.boneInverses[armBoneIdx]).invert().premultiply(invBind);
            radial.transformDirection(meshFromBone).normalize();
            const push = armPush * influence;
            armDeltas[i * 3] = radial.x * push;
            armDeltas[i * 3 + 1] = radial.y * push;
            armDeltas[i * 3 + 2] = radial.z * push;
          }
        }

        // —— Ombro: lateral (deltóide). Proximal do braço + peso do Shoulder ——
        const deltZone = Math.exp(-(((along - 0.08) / 0.16) ** 2));
        const shoulderInfluence = Math.max(shSkin, armSkin * deltZone * 0.85);
        if (shoulderInfluence >= 0.12) {
          const sideX = isLeft ? 1 : -1;
          pushDir.set(sideX, 0.05, 0);

          if (shBoneIdx >= 0) {
            const shSpace = tmp.clone()
              .applyMatrix4(obj.bindMatrix)
              .applyMatrix4(skeleton.boneInverses[shBoneIdx]);
            radial.set(shSpace.x, 0, shSpace.z);
            if (radial.lengthSq() > 1e-8) {
              radial.normalize();
              meshFromBone.copy(skeleton.boneInverses[shBoneIdx]).invert().premultiply(invBind);
              radial.transformDirection(meshFromBone).normalize();
              if (radial.x * sideX > 0) {
                pushDir.x += radial.x * 0.35;
                pushDir.y += radial.y * 0.2;
                pushDir.z += radial.z * 0.15;
              }
            }
          }
          pushDir.normalize();

          const lateralBias = THREE.MathUtils.clamp(Math.abs(tmp.x) * 4.5, 0.25, 1);
          const influence = shoulderInfluence * deltZone * lateralBias;
          if (influence >= 0.04) {
            const push = shoulderPush * influence;
            shoulderDeltas[i * 3] = pushDir.x * push;
            shoulderDeltas[i * 3 + 1] = pushDir.y * push;
            shoulderDeltas[i * 3 + 2] = pushDir.z * push;
          }
        }
      }

      // —— Antebraço: radial no meio do ForeArm ——
      if (foreBoneIdx >= 0 && foreSkin >= 0.18) {
        boneSpace.copy(tmp).applyMatrix4(obj.bindMatrix).applyMatrix4(skeleton.boneInverses[foreBoneIdx]);
        const foreLen = boneLength(skeleton.bones[foreBoneIdx]) || 0.22;
        const along = THREE.MathUtils.clamp(boneSpace.y / foreLen, 0, 1);
        const belly = Math.exp(-(((along - 0.42) / 0.22) ** 2));
        const influence = foreSkin * belly;
        if (influence >= 0.03) {
          radial.set(boneSpace.x, 0, boneSpace.z);
          if (radial.lengthSq() > 1e-8) {
            radial.normalize();
            meshFromBone.copy(skeleton.boneInverses[foreBoneIdx]).invert().premultiply(invBind);
            radial.transformDirection(meshFromBone).normalize();
            const push = forearmPush * influence;
            forearmDeltas[i * 3] = radial.x * push;
            forearmDeltas[i * 3 + 1] = radial.y * push;
            forearmDeltas[i * 3 + 2] = radial.z * push;
          }
        }
      }

      // —— Peitoral: caixa rasa sob a clavícula + fenda fina no esterno ——
      // Anatomia lean: fan flat, fundo na linha do mamilo (não desce pra barriga).
      // SG male: frente = +Z; peito alto no Spine2 ≈ by -0.08..0.12
      if (chestBoneIdx >= 0 && spineSkin >= 0.22 && armSkin < 0.38 && tmp.z > 0.02) {
        boneSpace.copy(tmp).applyMatrix4(obj.bindMatrix).applyMatrix4(skeleton.boneInverses[chestBoneIdx]);
        const ax = Math.abs(tmp.x);
        const front = smoothstep(0.02, 0.06, tmp.z);
        // sobe o peito (corta abs) e corta antes do pescoço
        const vertical = smoothstep(-0.10, -0.04, boneSpace.y) * (1 - smoothstep(0.10, 0.15, boneSpace.y));
        // placa: nasce perto do esterno, corta antes da axila
        const plate = smoothstep(0.006, 0.016, ax) * (1 - smoothstep(0.078, 0.105, ax));
        // fenda estreita (só o sulco do esterno)
        const cleft = Math.exp(-((ax / 0.0055) ** 2));
        const plateMask = plate * vertical * front * THREE.MathUtils.clamp(spineSkin, 0, 1);
        const forwardAmt = plateMask * (1 - cleft * 0.55);
        const cleftAmt = cleft * vertical * front * THREE.MathUtils.clamp(spineSkin, 0, 1);
        if (forwardAmt >= 0.025 || cleftAmt >= 0.05) {
          const side = tmp.x >= 0 ? 1 : -1;
          const push = chestPush * forwardAmt;
          chestDeltas[i * 3] = side * 0.08 * push;
          chestDeltas[i * 3 + 1] = 0.12 * push;
          chestDeltas[i * 3 + 2] = push - chestCleft * cleftAmt;
        }
      }
    }

    // Morphs do Shot Generator aplicados na CPU (o shader + material clay não estava mudando a skin)
    const dict = obj.morphTargetDictionary || {};
    const morphPos = geo.morphAttributes?.position || [];
    const copyMorph = (key) => {
      const idx = dict[key];
      if (idx == null || !morphPos[idx]) return new Float32Array(count * 3);
      return new Float32Array(morphPos[idx].array);
    };
    obj.userData.bindPos = bindPos;
    obj.userData.armDeltas = armDeltas;
    obj.userData.forearmDeltas = forearmDeltas;
    obj.userData.shoulderDeltas = shoulderDeltas;
    obj.userData.chestDeltas = chestDeltas;
    obj.userData.skinnyMorph = copyMorph('Skinny');
    obj.userData.muscularMorph = copyMorph('Muscular');
    obj.userData.obeseMorph = copyMorph('Obese');
    if (obj.morphTargetInfluences) {
      for (let m = 0; m < obj.morphTargetInfluences.length; m += 1) {
        obj.morphTargetInfluences[m] = 0;
      }
    }
    obj.userData.muscleReady = true;
  });
}

function applyLocalParts(root, parts = {}, morph = {}) {
  const arms = clamp01(parts.arms);
  const forearms = clamp01(parts.forearms);
  const shoulders = clamp01(parts.shoulders);
  const chest = clamp01(parts.chest);
  const calves = clamp01(parts.calves);
  const skinny = clamp01(morph.Skinny);
  const muscular = clamp01(morph.Muscular);
  const obese = clamp01(morph.Obese);

  root.traverse((obj) => {
    if (!obj.isSkinnedMesh || !obj.userData.muscleReady) return;
    const pos = obj.geometry.attributes.position;
    const bind = obj.userData.bindPos;
    const armD = obj.userData.armDeltas;
    const foreD = obj.userData.forearmDeltas;
    const shD = obj.userData.shoulderDeltas;
    const chD = obj.userData.chestDeltas || armD;
    const chestW = obj.userData.chestDeltas ? chest : 0;
    const sk = obj.userData.skinnyMorph;
    const mu = obj.userData.muscularMorph;
    const ob = obj.userData.obeseMorph;
    for (let i = 0; i < pos.count; i += 1) {
      const i3 = i * 3;
      pos.array[i3] = bind[i3]
        + sk[i3] * skinny
        + mu[i3] * muscular
        + ob[i3] * obese
        + armD[i3] * arms
        + foreD[i3] * forearms
        + shD[i3] * shoulders
        + chD[i3] * chestW;
      pos.array[i3 + 1] = bind[i3 + 1]
        + sk[i3 + 1] * skinny
        + mu[i3 + 1] * muscular
        + ob[i3 + 1] * obese
        + armD[i3 + 1] * arms
        + foreD[i3 + 1] * forearms
        + shD[i3 + 1] * shoulders
        + chD[i3 + 1] * chestW;
      pos.array[i3 + 2] = bind[i3 + 2]
        + sk[i3 + 2] * skinny
        + mu[i3 + 2] * muscular
        + ob[i3 + 2] * obese
        + armD[i3 + 2] * arms
        + foreD[i3 + 2] * forearms
        + shD[i3 + 2] * shoulders
        + chD[i3 + 2] * chestW;
    }
    pos.needsUpdate = true;
    obj.geometry.boundingBox = null;
    obj.geometry.boundingSphere = null;
    obj.geometry.computeVertexNormals();
  });

  const bones = new Map();
  root.traverse((obj) => {
    if (obj.name) bones.set(obj.name, obj);
  });

  for (const name of ['LeftShoulder', 'RightShoulder', 'Spine1', 'Spine2', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm']) {
    const bone = bones.get(name);
    if (bone) bone.scale.set(1, 1, 1);
  }

  const calfThick = 1 + calves * 0.18;
  for (const name of ['LeftLeg', 'RightLeg']) {
    const bone = bones.get(name);
    if (!bone) continue;
    bone.scale.set(calfThick, 1, calfThick);
  }

  root.updateMatrixWorld(true);
}

function ShotBody({ gender, definition, volume, parts, heightCm }) {
  const path = gender === 'female' ? '/models/sg-female.glb' : '/models/sg-male.glb';
  const { scene } = useGLTF(path);
  const weights = useMemo(
    () => morphWeights(definition, volume),
    [definition, volume],
  );

  const root = useMemo(() => {
    // SkeletonUtils mantém o skin ligado aos ossos clonados
    const cloned = cloneSkinned(scene);
    cloned.traverse((obj) => {
      if (!obj.isMesh) return;
      const name = (obj.name || '').toLowerCase();
      // mantém só o LOD0 (melhor detalhe + morphs)
      if (name.includes('lod') && !name.includes('lod0')) {
        obj.visible = false;
        return;
      }
      // SkeletonUtils reutiliza a geometry do cache do GLTF — precisa clonar
      // antes de gravar morphs/bulges no buffer de posição.
      if (obj.isSkinnedMesh) {
        obj.geometry = obj.geometry.clone();
      }
      obj.castShadow = true;
      obj.receiveShadow = true;
      const paintClay = (mat) => {
        const next = mat.clone();
        next.color = new THREE.Color('#9a9a9a');
        next.roughness = 0.55;
        next.metalness = 0.05;
        next.map = null;
        next.normalMap = null;
        next.emissiveMap = null;
        next.needsUpdate = true;
        return next;
      };
      obj.material = Array.isArray(obj.material)
        ? obj.material.map(paintClay)
        : paintClay(obj.material);
      if (obj.geometry && !obj.geometry.attributes.normal) {
        obj.geometry.computeVertexNormals();
      }
    });

    applyAttentionStance(cloned);
    prepareMuscleData(cloned);

    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.x -= center.x;
    cloned.position.z -= center.z;
    cloned.position.y -= box.min.y;
    return cloned;
  }, [scene, STANCE_REV]);

  useEffect(() => {
    applyLocalParts(root, parts, weights);
  }, [root, weights, parts]);

  const heightScale = Math.min(1.15, Math.max(0.85, ((heightCm || 174) / 100) / SG_MALE_HEIGHT_M));

  return (
    <group position={[-0.22, 0, 0]} rotation={[0, 0.12, 0]} scale={0.94 * heightScale}>
      <primitive object={root} />
    </group>
  );
}

function Scene({ gender, definition, volume, parts, heightCm }) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <hemisphereLight intensity={0.85} color="#f5f0e6" groundColor="#2a231b" />
      <directionalLight position={[2.4, 4.5, 2.8]} intensity={1.55} castShadow />
      <directionalLight position={[-2.2, 1.5, -1.2]} intensity={0.45} color="#a8b892" />
      <Suspense fallback={null}>
        <ShotBody
          key={gender || 'male'}
          gender={gender}
          definition={definition}
          volume={volume}
          parts={parts}
          heightCm={heightCm}
        />
      </Suspense>
      <ContactShadows position={[-0.22, -0.01, 0]} opacity={0.35} scale={4.5} blur={2.4} far={4} />
      <OrbitControls
        makeDefault
        enablePan={false}
        target={[-0.22, 0.9, 0]}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI / 1.9}
        minDistance={2.35}
        maxDistance={4.4}
      />
    </>
  );
}

export function BodyAvatar({
  gender,
  definition = 0,
  volume = 0.15,
  parts = {},
  heightCm = 174,
  label,
  children,
}) {
  return (
    <div className="body-stage" aria-label="Avatar 3D do corpo">
      <div className="body-stage-view">
        <Canvas
          shadows
          camera={{ position: [0.2, 1.02, 3.35], fov: 26, near: 0.1, far: 50 }}
          dpr={[1, 1.6]}
          gl={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
        >
          <Scene
            gender={gender}
            definition={definition}
            volume={volume}
            parts={parts}
            heightCm={heightCm}
          />
        </Canvas>
        <p className="body-hint">
          {label || 'Arraste para girar'} · o corpo muda com o treino
        </p>
      </div>
      {children}
    </div>
  );
}
