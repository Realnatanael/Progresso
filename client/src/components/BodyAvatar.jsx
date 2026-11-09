import { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

useGLTF.preload('/models/sg-male.glb');
useGLTF.preload('/models/sg-female.glb');

/** Bumpe quando pose/morph local mudar, para reclonar o skeleton no HMR. */
const STANCE_REV = 36;

const RECOVERY_GLOW = {
  red: new THREE.Color('#e84a3c'),
  yellow: new THREE.Color('#e2a23a'),
  green: new THREE.Color('#4caf6a'),
  blue: new THREE.Color('#4a8fe8'),
};
const CLAY = new THREE.Color('#9a9a9a');
const GLOW_WHITE = new THREE.Color('#ffffff');
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
 * Morphs locais leves no bind pose (dica de volume, não estágio da arte):
 * braço, antebraço, ombro, peitoral, coxa, panturrilha, glúteo.
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
    const hips = skeleton.bones.findIndex((b) => b.name === 'Hips');
    const leftUpLeg = skeleton.bones.findIndex((b) => b.name === 'LeftUpLeg');
    const rightUpLeg = skeleton.bones.findIndex((b) => b.name === 'RightUpLeg');
    const leftLeg = skeleton.bones.findIndex((b) => b.name === 'LeftLeg');
    const rightLeg = skeleton.bones.findIndex((b) => b.name === 'RightLeg');
    if (
      leftArm < 0 && rightArm < 0
      && spine2 < 0 && spine1 < 0
      && leftUpLeg < 0 && rightUpLeg < 0
    ) return;

    invBind.copy(obj.bindMatrix).invert();

    const count = pos.count;
    const bindPos = new Float32Array(pos.array);
    const armDeltas = new Float32Array(count * 3);
    const forearmDeltas = new Float32Array(count * 3);
    const shoulderDeltas = new Float32Array(count * 3);
    const chestDeltas = new Float32Array(count * 3);
    const thighDeltas = new Float32Array(count * 3);
    const calfDeltas = new Float32Array(count * 3);
    const gluteDeltas = new Float32Array(count * 3);
    const recoveryMasks = {
      shoulders: new Float32Array(count),
      biceps: new Float32Array(count),
      triceps: new Float32Array(count),
      forearms: new Float32Array(count),
      chest: new Float32Array(count),
      back: new Float32Array(count),
      glutes: new Float32Array(count),
      quads: new Float32Array(count),
      hamstrings: new Float32Array(count),
      calves: new Float32Array(count),
    };
    // Teto visual ≈ estágio 2.5→3: mais definição que o “leve”, sem bola.
    const armPush = 0.014;
    const forearmPush = 0.011;
    const shoulderPush = 0.02;
    const chestPush = 0.016;
    const chestCleft = 0.0028;
    const thighPush = 0.019;
    const calfPush = 0.013;
    // 85→93: hemisfério suave (sigma largo = menos triangular)
    const glutePush = 0.038;
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
      let wHips = 0;
      let wLeftUp = 0;
      let wRightUp = 0;
      let wLeftCalf = 0;
      let wRightCalf = 0;
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
        if (idx === hips) wHips += w;
        if (idx === leftUpLeg) wLeftUp += w;
        if (idx === rightUpLeg) wRightUp += w;
        if (idx === leftLeg) wLeftCalf += w;
        if (idx === rightLeg) wRightCalf += w;
      }

      const armSkin = Math.max(wLeftArm, wRightArm);
      const foreSkin = Math.max(wLeftFore, wRightFore);
      const shSkin = Math.max(wLeftSh, wRightSh);
      const spineSkin = wSpine2 * 1.15 + wSpine1 + wSpine * 0.35;
      const upLegSkin = Math.max(wLeftUp, wRightUp);
      const calfSkin = Math.max(wLeftCalf, wRightCalf);
      const isLeft = (wLeftArm + wLeftFore + wLeftSh + wLeftUp + wLeftCalf)
        >= (wRightArm + wRightFore + wRightSh + wRightUp + wRightCalf);
      const armBoneIdx = isLeft ? leftArm : rightArm;
      const foreBoneIdx = isLeft ? leftFore : rightFore;
      const shBoneIdx = isLeft ? leftShoulder : rightShoulder;
      const upLegBoneIdx = isLeft ? leftUpLeg : rightUpLeg;
      const calfBoneIdx = isLeft ? leftLeg : rightLeg;

      tmp.fromBufferAttribute(pos, i);

      // —— Braço: espessura suave ao longo do osso (sem “bola” no meio) ——
      if (armBoneIdx >= 0 && armSkin >= 0.2) {
        boneSpace.copy(tmp).applyMatrix4(obj.bindMatrix).applyMatrix4(skeleton.boneInverses[armBoneIdx]);
        const armLen = boneLength(skeleton.bones[armBoneIdx]) || 0.23;
        const along = THREE.MathUtils.clamp(boneSpace.y / armLen, 0, 1);
        const belly = Math.exp(-(((along - 0.42) / 0.34) ** 2));
        const influence = armSkin * belly;
        if (influence >= 0.04) {
          let frontArm = 0.5;
          radial.set(boneSpace.x, 0, boneSpace.z);
          if (radial.lengthSq() > 1e-8) {
            radial.normalize();
            meshFromBone.copy(skeleton.boneInverses[armBoneIdx]).invert().premultiply(invBind);
            radial.transformDirection(meshFromBone).normalize();
            const push = armPush * influence;
            armDeltas[i * 3] = radial.x * push;
            armDeltas[i * 3 + 1] = radial.y * push;
            armDeltas[i * 3 + 2] = radial.z * push;
            // Face do braço em malha: +Z = frente (bíceps), −Z = costas (tríceps).
            // Não usar tmp.z: com o braço colado ao tronco os dois lados ficam no mesmo Z.
            frontArm = Math.pow(smoothstep(-0.28, 0.32, radial.z), 1.25);
          } else {
            frontArm = Math.pow(smoothstep(-0.02, 0.05, tmp.z), 1.2);
          }
          const rearArm = Math.pow(1 - frontArm, 1.05);
          recoveryMasks.biceps[i] = Math.max(recoveryMasks.biceps[i], influence * frontArm);
          recoveryMasks.triceps[i] = Math.max(recoveryMasks.triceps[i], influence * rearArm);
        }

        // —— Ombro: lateral suave ——
        const deltZone = Math.exp(-(((along - 0.08) / 0.22) ** 2));
        const shoulderInfluence = Math.max(shSkin, armSkin * deltZone * 0.75);
        if (shoulderInfluence >= 0.14) {
          const sideX = isLeft ? 1 : -1;
          pushDir.set(sideX, 0.06, tmp.z > 0 ? 0.2 : 0.04);

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
                pushDir.x += radial.x * 0.3;
                pushDir.y += radial.y * 0.15;
                pushDir.z += radial.z * 0.12;
              }
            }
          }
          pushDir.normalize();

          const lateralBias = THREE.MathUtils.clamp(Math.abs(tmp.x) * 4.2, 0.25, 1);
          const influence = shoulderInfluence * deltZone * lateralBias;
          if (influence >= 0.05) {
            const push = shoulderPush * influence;
            shoulderDeltas[i * 3] = pushDir.x * push;
            shoulderDeltas[i * 3 + 1] = pushDir.y * push;
            shoulderDeltas[i * 3 + 2] = pushDir.z * push;
            recoveryMasks.shoulders[i] = Math.max(recoveryMasks.shoulders[i], influence);
          }
        }
      }

      // —— Antebraço: espessura suave ——
      if (foreBoneIdx >= 0 && foreSkin >= 0.2) {
        boneSpace.copy(tmp).applyMatrix4(obj.bindMatrix).applyMatrix4(skeleton.boneInverses[foreBoneIdx]);
        const foreLen = boneLength(skeleton.bones[foreBoneIdx]) || 0.22;
        const along = THREE.MathUtils.clamp(boneSpace.y / foreLen, 0, 1);
        const belly = Math.exp(-(((along - 0.4) / 0.32) ** 2));
        const influence = foreSkin * belly;
        if (influence >= 0.04) {
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
          recoveryMasks.forearms[i] = Math.max(recoveryMasks.forearms[i], influence);
        }
      }

      // —— Peitoral: altura/miolo como antes + lateral um pouco mais larga ——
      if (chestBoneIdx >= 0 && spineSkin >= 0.18 && tmp.z > 0.016 && armSkin < 0.72) {
        boneSpace.copy(tmp).applyMatrix4(obj.bindMatrix).applyMatrix4(skeleton.boneInverses[chestBoneIdx]);
        const ax = Math.abs(tmp.x);
        const front = smoothstep(0.016, 0.05, tmp.z);
        // faixa vertical original (inclui a parte de cima)
        const vertical = smoothstep(-0.11, -0.04, boneSpace.y) * (1 - smoothstep(0.095, 0.145, boneSpace.y));
        // um pouco mais largo que o original, sem baixar o peito
        const plate = smoothstep(0.005, 0.014, ax) * (1 - smoothstep(0.108, 0.145, ax));
        const lateral = smoothstep(0.02, 0.07, ax);
        const armGate = 1 - smoothstep(0.48, 0.72, armSkin);
        const cleft = Math.exp(-((ax / 0.0048) ** 2));
        const plateMask = plate * vertical * front * armGate * THREE.MathUtils.clamp(spineSkin, 0, 1);
        // miolo forte; lateral só um reforço leve
        const forwardAmt = plateMask * (1 - cleft * 0.58) * (0.92 + 0.2 * lateral);
        const cleftAmt = cleft * vertical * front * THREE.MathUtils.clamp(spineSkin, 0, 1);
        const shelf = smoothstep(-0.11, -0.07, boneSpace.y) * (1 - smoothstep(-0.055, -0.025, boneSpace.y));
        if (forwardAmt >= 0.022 || cleftAmt >= 0.04) {
          const side = tmp.x >= 0 ? 1 : -1;
          const push = chestPush * forwardAmt;
          const shelfPush = chestPush * 0.55 * shelf * plate * front * armGate;
          chestDeltas[i * 3] = side * (0.14 + 0.14 * lateral) * push;
          chestDeltas[i * 3 + 1] = 0.12 * push + 0.2 * shelfPush;
          chestDeltas[i * 3 + 2] = push + shelfPush * 0.65 - chestCleft * cleftAmt;
          recoveryMasks.chest[i] = Math.max(recoveryMasks.chest[i], Math.max(forwardAmt, cleftAmt));
        }
      }

      // —— Costas: tronco posterior (máscara suave) ——
      if (spineSkin >= 0.14 && armSkin < 0.5 && tmp.z < -0.008) {
        const rear = smoothstep(-0.004, -0.055, tmp.z);
        const mid = THREE.MathUtils.clamp(spineSkin, 0, 1);
        const ax = Math.abs(tmp.x);
        const width = smoothstep(0.001, 0.028, ax) * (1 - smoothstep(0.095, 0.145, ax));
        const vertical = smoothstep(-0.14, -0.02, tmp.y) * (1 - smoothstep(0.12, 0.22, tmp.y));
        recoveryMasks.back[i] = Math.max(
          recoveryMasks.back[i],
          mid * rear * Math.max(0.25, width) * Math.max(0.4, vertical),
        );
      }

      // —— Coxa: espessura suave no UpLeg (quad + lateral) ——
      if (upLegBoneIdx >= 0 && upLegSkin >= 0.18 && calfSkin < 0.55) {
        boneSpace.copy(tmp).applyMatrix4(obj.bindMatrix).applyMatrix4(skeleton.boneInverses[upLegBoneIdx]);
        const upLen = boneLength(skeleton.bones[upLegBoneIdx]) || 0.4;
        const along = THREE.MathUtils.clamp(boneSpace.y / upLen, 0, 1);
        // barriga no meio da coxa; evita joelho e virilha (sigma um pouco mais largo)
        const belly = Math.exp(-(((along - 0.42) / 0.34) ** 2));
        const influence = upLegSkin * belly;
        if (influence >= 0.03) {
          radial.set(boneSpace.x, 0, boneSpace.z);
          if (radial.lengthSq() > 1e-8) {
            radial.normalize();
            meshFromBone.copy(skeleton.boneInverses[upLegBoneIdx]).invert().premultiply(invBind);
            radial.transformDirection(meshFromBone).normalize();
            // levemente mais na frente (quad) e por fora
            const sideX = isLeft ? 1 : -1;
            pushDir.set(
              radial.x + sideX * 0.22,
              radial.y * 0.18,
              radial.z + (tmp.z > 0 ? 0.28 : 0.08),
            ).normalize();
            const push = thighPush * influence;
            thighDeltas[i * 3] = pushDir.x * push;
            thighDeltas[i * 3 + 1] = pushDir.y * push;
            thighDeltas[i * 3 + 2] = pushDir.z * push;
          }
          const frontThigh = smoothstep(-0.015, 0.03, tmp.z);
          recoveryMasks.quads[i] = Math.max(recoveryMasks.quads[i], influence * frontThigh);
          recoveryMasks.hamstrings[i] = Math.max(recoveryMasks.hamstrings[i], influence * (1 - frontThigh));
        }
      }

      // —— Panturrilha: ventre no meio da canela (Leg), volume espalhado ——
      if (calfBoneIdx >= 0 && calfSkin >= 0.2) {
        boneSpace.copy(tmp).applyMatrix4(obj.bindMatrix).applyMatrix4(skeleton.boneInverses[calfBoneIdx]);
        const calfLen = boneLength(skeleton.bones[calfBoneIdx]) || 0.38;
        const along = THREE.MathUtils.clamp(boneSpace.y / calfLen, 0, 1);
        const belly = Math.exp(-(((along - 0.38) / 0.28) ** 2));
        const influence = calfSkin * belly;
        if (influence >= 0.04) {
          radial.set(boneSpace.x, 0, boneSpace.z);
          if (radial.lengthSq() > 1e-8) {
            radial.normalize();
            meshFromBone.copy(skeleton.boneInverses[calfBoneIdx]).invert().premultiply(invBind);
            radial.transformDirection(meshFromBone).normalize();
            // gastrocnêmio: mais atrás (−Z se frente = +Z)
            pushDir.set(radial.x, radial.y * 0.15, radial.z + (tmp.z < 0 ? 0.35 : -0.05)).normalize();
            const push = calfPush * influence;
            calfDeltas[i * 3] = pushDir.x * push;
            calfDeltas[i * 3 + 1] = pushDir.y * push;
            calfDeltas[i * 3 + 2] = pushDir.z * push;
          }
          recoveryMasks.calves[i] = Math.max(recoveryMasks.calves[i], influence);
        }
      }

      // —— Glúteo: hemisfério suave (falloff largo, quase só −Z + leve fora) ——
      if ((hips >= 0 || upLegBoneIdx >= 0) && (wHips >= 0.08 || upLegSkin >= 0.1) && tmp.z < -0.008) {
        const gluteSkin = Math.min(1, wHips * 1.05 + upLegSkin * 0.6);
        let along = 0.05;
        if (upLegBoneIdx >= 0) {
          const upSpace = tmp.clone()
            .applyMatrix4(obj.bindMatrix)
            .applyMatrix4(skeleton.boneInverses[upLegBoneIdx]);
          const upLen = boneLength(skeleton.bones[upLegBoneIdx]) || 0.4;
          along = THREE.MathUtils.clamp(upSpace.y / upLen, 0, 1);
        }
        const side = tmp.x >= 0 ? 1 : -1;
        const ax = Math.abs(tmp.x);
        // sigma largo → plateau arredondado, sem pico triangular
        const cx = side * 0.05;
        const dx = (tmp.x - cx) / 0.078;
        const dy = (along - 0.06) / 0.16;
        const dz = (tmp.z + 0.065) / 0.07;
        const dist2 = dx * dx + dy * dy + dz * dz;
        // falloff mais suave que gauss puro (quase coseno)
        const lobe = Math.max(0, 1 - dist2) ** 1.35;
        const cleft = smoothstep(0.006, 0.022, ax);
        const rear = smoothstep(-0.005, -0.045, tmp.z);
        const influence = gluteSkin * lobe * cleft * rear;
        if (influence >= 0.02) {
          // direção estável: atrás dominante + fora leve (sem radial “ponta”)
          pushDir.set(side * 0.32, -0.06, -1);
          pushDir.normalize();
          const push = glutePush * influence;
          gluteDeltas[i * 3] = pushDir.x * push;
          gluteDeltas[i * 3 + 1] = pushDir.y * push;
          gluteDeltas[i * 3 + 2] = pushDir.z * push;
          recoveryMasks.glutes[i] = Math.max(recoveryMasks.glutes[i], influence);
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
    obj.userData.thighDeltas = thighDeltas;
    obj.userData.calfDeltas = calfDeltas;
    obj.userData.gluteDeltas = gluteDeltas;
    obj.userData.recoveryMasks = recoveryMasks;
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

const _glowA = new THREE.Color();
const _glowB = new THREE.Color();

/** Pinta regiões musculares conforme nível de recuperação (vermelho → apaga). */
function applyRecoveryGlow(root, recoveryMuscles = []) {
  const levelById = new Map(
    (recoveryMuscles || [])
      .filter((item) => item?.level && RECOVERY_GLOW[item.level])
      .map((item) => [item.id, item.level]),
  );
  const active = [...levelById.entries()];

  root.traverse((obj) => {
    if (!obj.isSkinnedMesh || !obj.userData.muscleReady) return;
    const masks = obj.userData.recoveryMasks;
    const pos = obj.geometry.attributes.position;
    if (!masks || !pos) return;

    let colors = obj.geometry.attributes.color;
    if (!colors || colors.count !== pos.count) {
      const arr = new Float32Array(pos.count * 3);
      colors = new THREE.BufferAttribute(arr, 3);
      obj.geometry.setAttribute('color', colors);
    }

    for (let i = 0; i < pos.count; i += 1) {
      _glowA.copy(CLAY);
      let strength = 0;
      for (const [id, level] of active) {
        const mask = masks[id];
        const raw = mask ? mask[i] : 0;
        // peito: preenche mais a lateral (máscara já é larga, o limiar antigo só mostrava o miolo)
        const soft = id === 'chest' ? 0.36 : 0.55;
        const amt = Math.pow(smoothstep(0.03, soft, raw), id === 'chest' ? 0.95 : 1.15);
        if (amt < 0.03) continue;
        _glowB.copy(RECOVERY_GLOW[level]);
        _glowA.lerp(_glowB, amt * 0.92);
        strength = Math.max(strength, amt);
      }
      if (strength > 0.06) {
        _glowA.lerp(GLOW_WHITE, strength * 0.16);
      }
      colors.setXYZ(i, _glowA.r, _glowA.g, _glowA.b);
    }
    colors.needsUpdate = true;

    const paint = (mat) => {
      if (!mat) return mat;
      mat.vertexColors = true;
      if (!mat.emissive) mat.emissive = new THREE.Color('#ffffff');
      mat.emissive.set('#ffffff');
      mat.emissiveIntensity = active.length ? 0.38 : 0;
      if (!mat.userData) mat.userData = {};
      if (!mat.userData.recoveryShader) {
        mat.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
             totalEmissiveRadiance *= vColor.rgb;`,
          );
        };
        mat.userData.recoveryShader = true;
        mat.needsUpdate = true;
      } else {
        mat.emissiveIntensity = active.length ? 0.38 : 0;
      }
      return mat;
    };
    if (Array.isArray(obj.material)) obj.material.forEach(paint);
    else paint(obj.material);
  });
}

function applyLocalParts(root, parts = {}, morph = {}) {
  const arms = clamp01(parts.arms);
  const forearms = clamp01(parts.forearms);
  const shoulders = clamp01(parts.shoulders);
  const chest = clamp01(parts.chest);
  const thighs = clamp01(parts.thighs);
  const calves = clamp01(parts.calves);
  const glutes = clamp01(parts.glutes);
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
    const thD = obj.userData.thighDeltas || armD;
    const caD = obj.userData.calfDeltas || armD;
    const glD = obj.userData.gluteDeltas || armD;
    const chestW = obj.userData.chestDeltas ? chest : 0;
    const thighW = obj.userData.thighDeltas ? thighs : 0;
    const calfW = obj.userData.calfDeltas ? calves : 0;
    const gluteW = obj.userData.gluteDeltas ? glutes : 0;
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
        + chD[i3] * chestW
        + thD[i3] * thighW
        + caD[i3] * calfW
        + glD[i3] * gluteW;
      pos.array[i3 + 1] = bind[i3 + 1]
        + sk[i3 + 1] * skinny
        + mu[i3 + 1] * muscular
        + ob[i3 + 1] * obese
        + armD[i3 + 1] * arms
        + foreD[i3 + 1] * forearms
        + shD[i3 + 1] * shoulders
        + chD[i3 + 1] * chestW
        + thD[i3 + 1] * thighW
        + caD[i3 + 1] * calfW
        + glD[i3 + 1] * gluteW;
      pos.array[i3 + 2] = bind[i3 + 2]
        + sk[i3 + 2] * skinny
        + mu[i3 + 2] * muscular
        + ob[i3 + 2] * obese
        + armD[i3 + 2] * arms
        + foreD[i3 + 2] * forearms
        + shD[i3 + 2] * shoulders
        + chD[i3 + 2] * chestW
        + thD[i3 + 2] * thighW
        + caD[i3 + 2] * calfW
        + glD[i3 + 2] * gluteW;
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

  for (const name of [
    'LeftShoulder', 'RightShoulder', 'Spine1', 'Spine2',
    'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
    'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'Hips',
  ]) {
    const bone = bones.get(name);
    if (bone) bone.scale.set(1, 1, 1);
  }

  root.updateMatrixWorld(true);
}

function ShotBody({ gender, definition, volume, parts, heightCm, recoveryMuscles, recoveryKey }) {
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

  useEffect(() => {
    applyRecoveryGlow(root, recoveryMuscles);
  }, [root, recoveryMuscles, recoveryKey]);

  const heightScale = Math.min(1.15, Math.max(0.85, ((heightCm || 174) / 100) / SG_MALE_HEIGHT_M));

  return (
    <group position={[-0.22, 0, 0]} rotation={[0, 0.12, 0]} scale={0.94 * heightScale}>
      <primitive object={root} />
    </group>
  );
}

function Scene({ gender, definition, volume, parts, heightCm, recoveryMuscles, recoveryKey }) {
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
          recoveryMuscles={recoveryMuscles}
          recoveryKey={recoveryKey}
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
  recoveryMuscles = [],
  recoveryKey = '',
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
            recoveryMuscles={recoveryMuscles}
            recoveryKey={recoveryKey}
          />
        </Canvas>
        <p className="body-hint">Arraste para girar</p>
      </div>
      {children}
    </div>
  );
}
