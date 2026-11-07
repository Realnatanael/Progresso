import { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

useGLTF.preload('/models/sg-male.glb');
useGLTF.preload('/models/sg-female.glb');

/** Bumpe quando `applyAttentionStance` mudar, para reclonar o skeleton no HMR. */
const STANCE_REV = 2;

/** Morphs Shot Generator: Skinny / Muscular / Obese */
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

function ShotBody({ gender, definition, volume }) {
  const path = gender === 'female' ? '/models/sg-female.glb' : '/models/sg-male.glb';
  const { scene } = useGLTF(path);
  const weights = useMemo(
    () => morphWeights(definition, volume),
    [definition, volume],
  );

  const root = useMemo(() => {
    // SkeletonUtils mantém o skin ligado aos ossos clonados
    const cloned = cloneSkinned(scene);
    const clay = new THREE.MeshStandardMaterial({
      color: '#9a9a9a',
      roughness: 0.55,
      metalness: 0.05,
    });

    cloned.traverse((obj) => {
      if (!obj.isMesh) return;
      const name = (obj.name || '').toLowerCase();
      // mantém só o LOD0 (melhor detalhe + morphs)
      if (name.includes('lod') && !name.includes('lod0')) {
        obj.visible = false;
        return;
      }
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.material = clay;
      if (obj.geometry && !obj.geometry.attributes.normal) {
        obj.geometry.computeVertexNormals();
      }
    });

    applyAttentionStance(cloned);

    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.x -= center.x;
    cloned.position.z -= center.z;
    cloned.position.y -= box.min.y;
    return cloned;
  }, [scene, STANCE_REV]);

  useEffect(() => {
    root.traverse((obj) => {
      if (!obj.isMesh || !obj.morphTargetDictionary || !obj.morphTargetInfluences) return;
      const dict = obj.morphTargetDictionary;
      const infl = obj.morphTargetInfluences;
      for (const [key, value] of Object.entries(weights)) {
        if (dict[key] == null) continue;
        infl[dict[key]] = value;
      }
    });
  }, [root, weights]);

  return (
    <group position={[-0.22, 0, 0]} rotation={[0, 0.12, 0]} scale={0.94}>
      <primitive object={root} />
    </group>
  );
}

function Scene({ gender, definition, volume }) {
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

export function BodyAvatar({ gender, definition = 0, volume = 0.15, label, children }) {
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
          <Scene gender={gender} definition={definition} volume={volume} />
        </Canvas>
        <p className="body-hint">
          {label || 'Arraste para girar'} · o corpo muda com o treino
        </p>
      </div>
      {children}
    </div>
  );
}
