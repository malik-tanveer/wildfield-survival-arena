import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import * as THREE from "three";
import {
  Activity,
  Crosshair,
  HeartPulse,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cameraRelativeMove, fireRound, MAGAZINE_SIZE, PLAYER_DAMAGE, reloadMagazine, SHOT_INTERVAL } from "@/game/sim/rules";

const PLAYER_MODEL = "/models/field-game/player.glb";
const ENEMY_MODEL = "/models/field-game/enemy.glb";
const RIFLE_MODEL = "/models/field-game/rifle.glb";
const BOT_SPAWNS = [
  [-9, -9],
  [-3, -12],
  [6, -11],
  [12, -5],
  [10, 8],
  [-8, 10],
] as const;

type Palette = Record<
  "ground" | "grass" | "soil" | "wood" | "rock" | "player" | "enemy" | "accent" | "sky",
  string
>;

type MatchState = {
  active: boolean;
  yaw: number;
  pitch: number;
  forward: number;
  strafe: number;
  firing: boolean;
  aiming: boolean;
  reloading: boolean;
  reloadTimer: number;
  shotTimer: number;
  playerHealth: number;
  ammo: number;
  elapsed: number;
  playerX: number;
  playerZ: number;
  bots: BotState[];
  hitUntil: number;
  finished: boolean;
};

type BotState = {
  x: number;
  z: number;
  health: number;
  active: boolean;
  attackTimer: number;
};

type HudState = {
  health: number;
  ammo: number;
  remaining: number;
  elapsed: number;
  hit: boolean;
};

type Controls = {
  heldKeys: Set<string>;
  joystick: { x: number; y: number };
};

const INITIAL_HUD: HudState = {
  health: 100,
  ammo: MAGAZINE_SIZE,
  remaining: BOT_SPAWNS.length,
  elapsed: 0,
  hit: false,
};

const makeBots = (): BotState[] =>
  BOT_SPAWNS.map(([x, z], index) => ({
    x,
    z,
    health: 100,
    active: true,
    attackTimer: 0.8 + index * 0.18,
  }));

const makeMatch = (): MatchState => ({
  active: false,
  yaw: 0,
  pitch: 0.39,
  forward: 0,
  strafe: 0,
  firing: false,
  aiming: false,
  reloading: false,
  reloadTimer: 0,
  shotTimer: 0,
  playerHealth: 100,
  ammo: MAGAZINE_SIZE,
  elapsed: 0,
  playerX: 0,
  playerZ: 2,
  bots: makeBots(),
  hitUntil: 0,
  finished: false,
});

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const read = (token: string) => {
    const sample = document.createElement("span");
    sample.style.color = `var(${token})`;
    document.body.append(sample);
    const value = getComputedStyle(sample).color;
    sample.remove();
    return value;
  };
  return {
    ground: read("--world-ground"),
    grass: read("--world-grass"),
    soil: read("--world-soil"),
    wood: read("--world-wood"),
    rock: read("--world-rock"),
    player: read("--world-player"),
    enemy: read("--world-enemy"),
    accent: read("--world-accent"),
    sky: read("--ops-muted"),
  };
}

function makeGroundTexture(color: string): THREE.DataTexture {
  const side = 128;
  const base = new THREE.Color(color);
  const pixels = new Uint8Array(side * side * 4);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const index = (y * side + x) * 4;
      const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grain = ((noise - Math.floor(noise)) - 0.5) * 24;
      pixels[index] = Math.max(0, Math.min(255, base.r * 255 + grain));
      pixels[index + 1] = Math.max(0, Math.min(255, base.g * 255 + grain));
      pixels[index + 2] = Math.max(0, Math.min(255, base.b * 255 + grain));
      pixels[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, side, side, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function Ground({ palette }: { palette: Palette }) {
  const texture = useMemo(() => makeGroundTexture(palette.ground), [palette.ground]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.06} receiveShadow>
        <planeGeometry args={[64, 64]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.045}>
        <ringGeometry args={[17.92, 18, 96]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.88} />
      </mesh>
    </>
  );
}

function FieldProps({ palette }: { palette: Palette }) {
  const cover = [
    { x: -5, z: -3, kind: "crate" },
    { x: 4, z: -5, kind: "crate" },
    { x: -11, z: 2, kind: "barrel" },
    { x: 8, z: 1, kind: "barrel" },
    { x: 0, z: -10, kind: "barrier" },
    { x: 3, z: 9, kind: "barrier" },
    { x: -13, z: -9, kind: "rock" },
    { x: 14, z: 3, kind: "rock" },
    { x: -8, z: -5, kind: "tent" },
    { x: 9, z: -10, kind: "tent" },
  ];
  const trees = [
    [-17, -13], [-19, -3], [-17, 9], [-12, 16], [-1, 19], [10, 17],
    [18, 11], [20, 0], [17, -12], [7, -19], [-8, -19],
  ];
  return (
    <group>
      {cover.map((item, index) => (
        <group key={`${item.kind}-${index}`} position={[item.x, 0, item.z]}>
          {item.kind === "crate" && (
            <>
              <mesh castShadow position={[0, 0.48, 0]}>
                <boxGeometry args={[1.35, 0.95, 1.15]} />
                <meshStandardMaterial color={palette.wood} roughness={0.95} />
              </mesh>
              <mesh position={[0, 0.48, 0.59]}>
                <boxGeometry args={[1.18, 0.09, 0.03]} />
                <meshStandardMaterial color={palette.soil} />
              </mesh>
              <mesh position={[0, 0.48, -0.59]}>
                <boxGeometry args={[1.18, 0.09, 0.03]} />
                <meshStandardMaterial color={palette.soil} />
              </mesh>
            </>
          )}
          {item.kind === "barrel" && (
            <>
              <mesh castShadow position={[0, 0.48, 0]}>
                <cylinderGeometry args={[0.42, 0.42, 0.95, 12]} />
                <meshStandardMaterial color={palette.rock} roughness={0.8} />
              </mesh>
              {[0.22, 0.62].map((y) => (
                <mesh key={y} position={[0, y, 0]}>
                  <torusGeometry args={[0.421, 0.028, 6, 12]} />
                  <meshStandardMaterial color={palette.wood} metalness={0.2} />
                </mesh>
              ))}
            </>
          )}
          {item.kind === "barrier" && (
            <group rotation-y={index % 2 ? -0.16 : 0.16}>
              {[-0.56, 0, 0.56].map((x) => (
                <mesh key={x} castShadow position={[x, 0.36, 0]}>
                  <boxGeometry args={[0.52, 0.72, 0.86]} />
                  <meshStandardMaterial color={palette.soil} roughness={1} />
                </mesh>
              ))}
            </group>
          )}
          {item.kind === "rock" && (
            <mesh castShadow position={[0, 0.52, 0]} scale={[1.15, 0.75, 0.9]}>
              <dodecahedronGeometry args={[0.86, 0]} />
              <meshStandardMaterial color={palette.rock} roughness={1} flatShading />
            </mesh>
          )}
          {item.kind === "tent" && (
            <>
              <mesh castShadow position={[0, 0.8, 0]} rotation-z={Math.PI / 2}>
                <coneGeometry args={[0.98, 1.8, 3]} />
                <meshStandardMaterial color={palette.player} roughness={1} flatShading />
              </mesh>
              <mesh position={[0, 0.03, 0]}>
                <boxGeometry args={[1.55, 0.06, 1.5]} />
                <meshStandardMaterial color={palette.wood} roughness={1} />
              </mesh>
            </>
          )}
        </group>
      ))}
      {trees.map(([x, z], index) => (
        <group key={`tree-${index}`} position={[x, 0, z]} rotation-y={index * 0.31}>
          <mesh castShadow position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.17, 0.27, 1.7, 6]} />
            <meshStandardMaterial color={palette.wood} roughness={1} />
          </mesh>
          {[1.55, 2.28, 2.88].map((height, layer) => (
            <mesh key={height} castShadow position={[0, height, 0]}>
              <coneGeometry args={[1.25 - layer * 0.22, 1.75 - layer * 0.16, 7]} />
              <meshStandardMaterial
                color={layer === 0 ? palette.grass : palette.ground}
                roughness={1}
                flatShading
              />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[-15, 1.7, 0]} castShadow>
        <boxGeometry args={[0.3, 3.4, 0.3]} />
        <meshStandardMaterial color={palette.wood} />
      </mesh>
      <mesh position={[-15, 3.5, 0]}>
        <boxGeometry args={[0.8, 0.18, 0.8]} />
        <meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[15, 0.45, 12]} castShadow>
        <boxGeometry args={[1.1, 0.9, 1.1]} />
        <meshStandardMaterial color={palette.accent} roughness={0.7} />
      </mesh>
      <mesh position={[15, 0.94, 12]}>
        <boxGeometry args={[0.7, 0.09, 0.06]} />
        <meshStandardMaterial color={palette.soil} />
      </mesh>
    </group>
  );
}

function ActorModel({
  enemy,
  moving,
  position,
  groupRef,
  children,
}: {
  enemy: boolean;
  moving: () => boolean;
  position: [number, number, number];
  groupRef: React.RefObject<THREE.Group | null>;
  children?: React.ReactNode;
}) {
  const model = useGLTF(enemy ? ENEMY_MODEL : PLAYER_MODEL);
  const character = useMemo(() => cloneSkeleton(model.scene), [model.scene]);
  const animationRoot = useRef<THREE.Group>(null);
  const { actions } = useAnimations(model.animations, animationRoot);
  const currentAnimation = useRef("");

  useEffect(() => {
    const idle = actions.idle;
    idle?.reset().fadeIn(0.2).play();
    currentAnimation.current = "idle";
  }, [actions]);

  useFrame(() => {
    const next = moving() ? "walk" : "idle";
    if (next !== currentAnimation.current) {
      actions[currentAnimation.current]?.fadeOut(0.16);
      actions[next]?.reset().fadeIn(0.16).play();
      currentAnimation.current = next;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <group ref={animationRoot} scale={2.15}>
        <primitive object={character} />
        {!enemy && <PlayerRifle />}
      </group>
      {children}
    </group>
  );
}

function PlayerRifle() {
  const model = useGLTF(RIFLE_MODEL);
  const rifle = useMemo(() => cloneSkeleton(model.scene), [model.scene]);
  return (
    <group position={[0.19, 0.61, 0.12]} scale={3.25}>
      <primitive object={rifle} />
    </group>
  );
}

function ArenaActors({
  match,
  controls,
  palette,
  onUpdate,
  onFinished,
  onReady,
}: {
  match: React.MutableRefObject<MatchState>;
  controls: React.MutableRefObject<Controls>;
  palette: Palette;
  onUpdate: (state: HudState) => void;
  onFinished: (victory: boolean) => void;
  onReady: () => void;
}) {
  const playerRef = useRef<THREE.Group>(null);
  const botRefs = useRef<Array<THREE.Group | null>>([]);
  const aimDirection = useRef(new THREE.Vector3());
  const aimOrigin = useRef(new THREE.Vector3());
  const cameraPosition = useRef(new THREE.Vector3());
  const lastHud = useRef(0);
  const { camera } = useThree();
  const playerMoves = useCallback(() => Math.abs(match.current.forward) + Math.abs(match.current.strafe) > 0.1, [match]);
  const botMoves = useMemo(() => BOT_SPAWNS.map((_, index) => () => {
    const bot = match.current.bots[index];
    return Boolean(bot?.active && Math.hypot(bot.x - match.current.playerX, bot.z - match.current.playerZ) > 3.1);
  }), [match]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const current = match.current;
    const player = playerRef.current;
    if (!player) return;

    const keySet = controls.current.heldKeys;
    const forward =
      (keySet.has("KeyW") || keySet.has("ArrowUp") ? 1 : 0) -
      (keySet.has("KeyS") || keySet.has("ArrowDown") ? 1 : 0) +
      controls.current.joystick.y;
    const strafe =
      (keySet.has("KeyD") || keySet.has("ArrowRight") ? 1 : 0) -
      (keySet.has("KeyA") || keySet.has("ArrowLeft") ? 1 : 0) +
      controls.current.joystick.x;
    const move = cameraRelativeMove(forward, strafe, current.yaw);
    current.forward = forward;
    current.strafe = strafe;

    if (current.active && !current.finished) {
      const speed = keySet.has("ShiftLeft") || keySet.has("ShiftRight") ? 6.5 : 4.5;
      current.playerX = THREE.MathUtils.clamp(current.playerX + move.x * speed * dt, -16.2, 16.2);
      current.playerZ = THREE.MathUtils.clamp(current.playerZ + move.z * speed * dt, -16.2, 16.2);
      current.elapsed += dt;

      if (current.reloading) {
        current.reloadTimer -= dt;
        if (current.reloadTimer <= 0) {
          current.ammo = reloadMagazine(current.ammo);
          current.reloading = false;
        }
      }

      current.shotTimer = Math.max(0, current.shotTimer - dt);
      if (current.firing && !current.reloading && current.shotTimer <= 0) {
        const result = fireRound(current.ammo);
        current.ammo = result.ammo;
        current.shotTimer = SHOT_INTERVAL;
        if (!result.fired) {
          current.reloading = true;
          current.reloadTimer = 1.35;
        } else {
          camera.getWorldDirection(aimDirection.current).normalize();
          camera.getWorldPosition(aimOrigin.current);
          let best: { bot: BotState; distance: number; index: number } | undefined;
          for (let index = 0; index < current.bots.length; index += 1) {
            const bot = current.bots[index];
            const botRef = botRefs.current[index];
            if (!bot?.active || !botRef) continue;
            botRef.getWorldPosition(cameraPosition.current);
            cameraPosition.current.y += 0.68;
            const offset = cameraPosition.current.clone().sub(aimOrigin.current);
            const depth = offset.dot(aimDirection.current);
            if (depth < 0 || depth > 30) continue;
            const distanceToSight = offset.addScaledVector(aimDirection.current, -depth).length();
            if (distanceToSight < 0.82 && (!best || depth < best.distance)) {
              best = { bot, distance: depth, index };
            }
          }
          if (best) {
            best.bot.health = Math.max(0, best.bot.health - PLAYER_DAMAGE);
            current.hitUntil = current.elapsed + 0.16;
            if (best.bot.health === 0) {
              best.bot.active = false;
              const botRef = botRefs.current[best.index];
              if (botRef) botRef.visible = false;
            }
          }
        }
      }

      for (const bot of current.bots) {
        if (!bot.active) continue;
        const dx = current.playerX - bot.x;
        const dz = current.playerZ - bot.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 4.2) {
          const step = Math.min(2.05 * dt, distance - 3.7);
          bot.x += (dx / distance) * step;
          bot.z += (dz / distance) * step;
        }
        bot.attackTimer -= dt;
        if (distance < 15 && bot.attackTimer <= 0) {
          current.playerHealth = Math.max(0, current.playerHealth - 7);
          bot.attackTimer = 1.42;
        }
      }

      const remaining = current.bots.filter((bot) => bot.active).length;
      if (remaining === 0) {
        current.finished = true;
        onFinished(true);
      } else if (current.playerHealth <= 0) {
        current.finished = true;
        onFinished(false);
      }
    }

    player.position.set(current.playerX, 0, current.playerZ);
    const moving = Math.hypot(move.x, move.z) > 0.05;
    const faceYaw = current.aiming || current.firing ? current.yaw : Math.atan2(move.x, move.z);
    if (moving || current.aiming || current.firing) {
      player.rotation.y = THREE.MathUtils.damp(player.rotation.y, faceYaw, 10, dt);
    }

    current.bots.forEach((bot, index) => {
      const actor = botRefs.current[index];
      if (!actor) return;
      actor.position.set(bot.x, 0, bot.z);
      if (bot.active) actor.rotation.y = Math.atan2(current.playerX - bot.x, current.playerZ - bot.z);
    });

    const cameraDistance = current.aiming ? 4.2 : 6.4;
    cameraPosition.current.set(
      current.playerX + Math.sin(current.yaw) * cameraDistance,
      2.45 + current.pitch * 2.15,
      current.playerZ - Math.cos(current.yaw) * cameraDistance,
    );
    camera.position.lerp(cameraPosition.current, 1 - Math.exp(-7 * dt));
    camera.lookAt(current.playerX, 1.24, current.playerZ);
    if (camera instanceof THREE.PerspectiveCamera) {
      const nextFov = current.aiming ? 48 : 61;
      if (Math.abs(camera.fov - nextFov) > 0.1) {
        camera.fov = THREE.MathUtils.damp(camera.fov, nextFov, 8, dt);
        camera.updateProjectionMatrix();
      }
    }

    if (state.clock.elapsedTime - lastHud.current > 0.11) {
      lastHud.current = state.clock.elapsedTime;
      onUpdate({
        health: current.playerHealth,
        ammo: current.ammo,
        remaining: current.bots.filter((bot) => bot.active).length,
        elapsed: current.elapsed,
        hit: current.hitUntil > current.elapsed,
      });
    }
  });

  return (
    <>
      <ActorModel
        enemy={false}
        moving={playerMoves}
        position={[0, 0, 2]}
        groupRef={playerRef}
      />
      {BOT_SPAWNS.map(([x, z], index) => (
        <ActorModel
          key={`bot-${index}`}
          enemy
          moving={botMoves[index] ?? (() => false)}
          position={[x, 0, z]}
          groupRef={{
            get current() {
              return botRefs.current[index] ?? null;
            },
            set current(value) {
              botRefs.current[index] = value;
            },
          }}
        >
          <mesh position={[0, 2.35, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.16, 0.2, 12]} />
            <meshBasicMaterial color={palette.enemy} />
          </mesh>
        </ActorModel>
      ))}
    </>
  );
}

function Stage({
  palette,
  match,
  controls,
  onUpdate,
  onFinished,
  onReady,
}: {
  palette: Palette;
  match: React.MutableRefObject<MatchState>;
  controls: React.MutableRefObject<Controls>;
  onUpdate: (state: HudState) => void;
  onFinished: (victory: boolean) => void;
  onReady: () => void;
}) {
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 29, 56]} />
      <hemisphereLight args={[palette.sky, palette.soil, 2.05]} />
      <directionalLight
        position={[-9, 16, 8]}
        intensity={2.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <Ground palette={palette} />
      <FieldProps palette={palette} />
      <Suspense fallback={null}>
        <ArenaActors
          match={match}
          controls={controls}
          palette={palette}
          onUpdate={onUpdate}
          onFinished={onFinished}
          onReady={onReady}
        />
      </Suspense>
    </>
  );
}

function formatTime(seconds: number) {
  const safeSeconds = Math.floor(seconds);
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const rest = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function GameScreen() {
  const [palette, setPalette] = useState<Palette | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<"victory" | "defeat" | null>(null);
  const [hud, setHud] = useState(INITIAL_HUD);
  const [matchKey, setMatchKey] = useState(0);
  const match = useRef<MatchState>(makeMatch());
  const controls = useRef<Controls>({ heldKeys: new Set(), joystick: { x: 0, y: 0 } });
  const joystickPointer = useRef<number | null>(null);
  const joystickElement = useRef<HTMLDivElement>(null);
  const canvasElement = useRef<HTMLCanvasElement | null>(null);
  const finishMatch = useCallback((victory: boolean) => {
    setResult(victory ? "victory" : "defeat");
    setStarted(false);
  }, []);
  const reportSceneReady = useCallback(() => setSceneReady(true), []);

  useEffect(() => setPalette(readPalette()), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
      }
      controls.current.heldKeys.add(event.code);
      if (event.code === "Space" && match.current.active) match.current.firing = true;
      if (event.code === "KeyR" && match.current.active && !match.current.reloading) {
        match.current.reloading = true;
        match.current.reloadTimer = 1.35;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      controls.current.heldKeys.delete(event.code);
      if (event.code === "Space") match.current.firing = false;
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvasElement.current || !match.current.active) return;
      match.current.yaw -= event.movementX * 0.0028;
      match.current.pitch = THREE.MathUtils.clamp(match.current.pitch - event.movementY * 0.0018, 0.18, 0.78);
    };
    const onPointerLockChange = () => {
      if (document.pointerLockElement !== canvasElement.current) {
        match.current.firing = false;
        match.current.aiming = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    };
  }, []);

  const startMatch = useCallback(() => {
    match.current = { ...makeMatch(), active: true };
    controls.current.heldKeys.clear();
    controls.current.joystick = { x: 0, y: 0 };
    setHud(INITIAL_HUD);
    setResult(null);
    setStarted(true);
  }, []);

  const startFiring = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!match.current.active) return;
    match.current.firing = true;
    if (canvasElement.current && document.pointerLockElement !== canvasElement.current && event.pointerType === "mouse") {
      void canvasElement.current.requestPointerLock();
    }
  }, []);

  const stopFiring = useCallback(() => {
    match.current.firing = false;
  }, []);

  const toggleAim = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && canvasElement.current && document.pointerLockElement !== canvasElement.current) {
      void canvasElement.current.requestPointerLock();
    }
    match.current.aiming = true;
  }, []);

  const stopAim = useCallback(() => {
    match.current.aiming = false;
  }, []);

  const reload = useCallback(() => {
    if (!match.current.active || match.current.reloading || match.current.ammo === MAGAZINE_SIZE) return;
    match.current.reloading = true;
    match.current.reloadTimer = 1.35;
  }, []);

  const beginJoystick = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    joystickPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width * 0.32);
    const y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height * 0.32);
    const length = Math.max(1, Math.hypot(x, y));
    controls.current.joystick = { x: THREE.MathUtils.clamp(x / length, -1, 1), y: THREE.MathUtils.clamp(-y / length, -1, 1) };
  }, []);

  const moveJoystick = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width * 0.32);
    const y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height * 0.32);
    const length = Math.max(1, Math.hypot(x, y));
    controls.current.joystick = { x: THREE.MathUtils.clamp(x / length, -1, 1), y: THREE.MathUtils.clamp(-y / length, -1, 1) };
  }, []);

  const endJoystick = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== event.pointerId) return;
    joystickPointer.current = null;
    controls.current.joystick = { x: 0, y: 0 };
  }, []);

  const moveKnob = () => {
    const input = controls.current.joystick;
    return { left: `${50 + input.x * 26}%`, top: `${50 - input.y * 26}%` };
  };

  const healthDanger = hud.health <= 35;
  const reloading = match.current.reloading;

  return (
    <main className="game-shell" data-game-screen data-scene-ready={sceneReady ? "true" : undefined}>
      {palette && (
        <div className="game-canvas" onContextMenu={(event) => event.preventDefault()}>
          <Canvas
            shadows
            dpr={[1, 1.4]}
            camera={{ position: [0, 4, -6], fov: 61, near: 0.1, far: 90 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              canvasElement.current = gl.domElement;
              gl.domElement.addEventListener("pointerdown", (event) => {
                if (event.button === 2) {
                  event.preventDefault();
                  if (match.current.active) match.current.aiming = true;
                } else if (event.button === 0 && match.current.active) {
                  match.current.firing = true;
                  if (document.pointerLockElement !== gl.domElement) void gl.domElement.requestPointerLock();
                }
              });
              gl.domElement.addEventListener("pointerup", (event) => {
                if (event.button === 0) match.current.firing = false;
                if (event.button === 2) match.current.aiming = false;
              });
              gl.domElement.addEventListener("pointerleave", () => {
                match.current.firing = false;
                match.current.aiming = false;
              });
            }}
          >
            <Stage
              palette={palette}
              match={match}
              controls={controls}
              onUpdate={setHud}
              onFinished={finishMatch}
              onReady={reportSceneReady}
            />
          </Canvas>
        </div>
      )}

      <div className="game-overlay">
        <header className="game-topbar">
          <div className="game-brand">
            <span className="game-brand-mark"><Target size={19} /></span>
            <span>
              <span className="game-brand-name">FIELD OPS</span>
              <span className="game-brand-tag block">SOLO SURVIVAL</span>
            </span>
          </div>

          <div className="game-objective">
            <Crosshair size={17} className="text-ops-orange" />
            <div className="game-objective-meta">
              <span className="game-label">Hostiles remaining</span>
              <strong>{hud.remaining.toString().padStart(2, "0")} <span className="game-label">/ 06</span></strong>
            </div>
          </div>

          <div className="game-side-stats">
            <div className="game-stat">
              <span className="game-label">Match time</span>
              <span className="game-stat-value">{formatTime(hud.elapsed)}</span>
            </div>
            <div className={`game-stat ${healthDanger ? "is-danger" : ""}`}>
              <span className="game-label">Armor</span>
              <span className="game-stat-value">{healthDanger ? "LOW" : "READY"}</span>
            </div>
          </div>
        </header>

        <div className={`game-crosshair ${hud.hit ? "is-hit" : ""}`} aria-hidden="true">
          <span className="game-crosshair-dot" />
        </div>

        <div className="game-bottom-left">
          <div
            className="game-joystick"
            data-control="movement joystick"
            role="slider"
            aria-label="Movement joystick"
            aria-valuemin={-1}
            aria-valuemax={1}
            onPointerDown={beginJoystick}
            onPointerMove={moveJoystick}
            onPointerUp={endJoystick}
            onPointerCancel={endJoystick}
          >
            <span className="game-joystick-knob" style={moveKnob()} />
          </div>
          <div className="game-player-status">
            <div className="game-player-line">
              <span className="game-label">Operative</span>
              <strong><HeartPulse size={14} className="inline -mt-0.5 mr-1" />{hud.health}%</strong>
            </div>
            <div className="game-player-health-track">
              <div className={`game-player-health-fill ${healthDanger ? "is-danger" : ""}`} style={{ width: `${hud.health}%` }} />
            </div>
            <span className="game-label">{healthDanger ? "Critical condition" : "Field condition stable"}</span>
          </div>
        </div>

        <div className="game-bottom-right">
          <div className="game-weapon-panel">
            <div className="game-weapon-line">
              <span className="game-weapon-name">FIELD RIFLE</span>
              <span className="game-label">AUTO</span>
            </div>
            <div className="game-weapon-line">
              <div className="game-ammo"><strong>{hud.ammo.toString().padStart(2, "0")}</strong><span>/ {MAGAZINE_SIZE}</span></div>
              <span className="game-label">{reloading ? "RELOADING" : "5.56 MM"}</span>
            </div>
          </div>
          <div className="game-actions">
            <Button
              type="button"
              variant="outline"
              className="game-action-button"
              aria-label="Reload rifle"
              title="Reload (R)"
              onClick={reload}
            >
              <RotateCcw />
              <span>Reload</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="game-action-button"
              aria-label="Aim"
              title="Hold to aim"
              onPointerDown={toggleAim}
              onPointerUp={stopAim}
              onPointerLeave={stopAim}
              onPointerCancel={stopAim}
            >
              <Crosshair />
              <span>Aim</span>
            </Button>
            <Button
              type="button"
              variant="default"
              className="game-action-button is-primary"
              aria-label="Fire rifle"
              title="Hold to fire (Space / click)"
              onPointerDown={startFiring}
              onPointerUp={stopFiring}
              onPointerLeave={stopFiring}
              onPointerCancel={stopFiring}
            >
              <Activity />
              <span>Fire</span>
            </Button>
          </div>
        </div>

        {started && (
          <div className="game-mobile-controls">
            <Button
              type="button"
              variant="outline"
              className="game-action-button"
              aria-label="Reload rifle"
              onClick={reload}
            >
              <RotateCcw /><span>Reload</span>
            </Button>
            <Button
              type="button"
              variant="default"
              className="game-action-button is-primary"
              aria-label="Fire rifle"
              onPointerDown={startFiring}
              onPointerUp={stopFiring}
              onPointerLeave={stopFiring}
              onPointerCancel={stopFiring}
            >
              <Activity /><span>Fire</span>
            </Button>
          </div>
        )}

        {!started && !result && (
          <section className="game-ready-screen" aria-label="Ready room">
            <div className="game-ready-panel">
              <span className="game-kicker">Tactical survival · field trial 01</span>
              <h1>LAST<br />SQUAD</h1>
              <p className="game-ready-copy">
                Six hostiles are moving through the training ground. Clear the field and make it back out.
              </p>
              <div className="game-loadout">
                <div><span className="game-label">Primary</span><strong>Field rifle · 30 rounds</strong></div>
                <div><span className="game-label">Threats</span><strong>06 hostiles</strong></div>
              </div>
              <Button type="button" className="game-primary-button" onClick={startMatch}>
                Deploy to field <Play size={16} />
              </Button>
              <p className="game-label mt-4">WASD move · Shift sprint · mouse aim · hold fire · R reload</p>
            </div>
          </section>
        )}

        {result && (
          <section className="game-result-screen" aria-label="Match result">
            <div className="game-result-panel">
              {result === "victory" ? <Shield size={34} /> : <Skull size={34} />}
              <span className="game-kicker block mt-3">Field trial complete</span>
              <h2>{result === "victory" ? "FIELD CLEARED" : "OPERATIVE DOWN"}</h2>
              <p className="game-result-copy">
                {result === "victory" ? "All hostiles neutralized. Excellent work." : "The field got the better of you. Regroup and redeploy."}
              </p>
              <Button type="button" className="game-primary-button" onClick={startMatch}>
                <span>Redeploy</span><Play size={16} />
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

useGLTF.preload(PLAYER_MODEL);
useGLTF.preload(ENEMY_MODEL);
useGLTF.preload(RIFLE_MODEL);