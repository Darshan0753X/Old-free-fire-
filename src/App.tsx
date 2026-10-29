import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GameMode,
  GameSettings,
  LobbyScreen,
  MatchHistoryRecord,
  SaveDataSchema,
  interfaceHUDStateSnapshot,
} from './types/game';
import {
  loadSaveData,
  recordMatchResult,
  resetAllSaveData,
  saveGameData,
} from './services/storage';
import { soundEngine } from './services/audio';
import { GameSimulationEngine } from './engine/GameSimulation';
import { MainMenuLobby } from './components/MainMenuLobby';
import { InGameHUD } from './components/InGameHUD';
import { HUDLayoutEditorModal } from './components/HUDLayoutEditorModal';
import { OfflineIndicator } from './components/PWAInstallButton';
import { Smartphone } from 'lucide-react';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameSimulationEngine | null>(null);

  const [saveData, setSaveData] = useState<SaveDataSchema>(() => loadSaveData());
  const [selectedMode, setSelectedMode] = useState<GameMode>('br_solo');
  const [activeLobbyScreen, setActiveLobbyScreen] =
    useState<LobbyScreen>('main');
  const [hudState, setHudState] = useState<interfaceHUDStateSnapshot | null>(
    null
  );
  const [hudEditorOpen, setHudEditorOpen] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissedPortraitHint, setDismissedPortraitHint] = useState(false);

  // Check portrait orientation on mobile screens
  useEffect(() => {
    const checkOrientation = () => {
      const portrait =
        window.innerHeight > window.innerWidth && window.innerWidth < 640;
      setIsPortraitMobile(portrait);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const handleMatchComplete = useCallback(
    (
      record: MatchHistoryRecord,
      extra: {
        suppliesCollected: number;
        zonesSurvived: number;
        landed: boolean;
        teamCommandsUsed: number;
        regionsVisited: string[];
      }
    ) => {
      setSaveData((prev) => recordMatchResult(prev, record, extra));
    },
    []
  );

  const handleTrainingComplete = useCallback(() => {
    setSaveData((prev) => {
      const next: SaveDataSchema = {
        ...prev,
        xp: prev.xp + 75,
        stats: {
          ...prev.stats,
          trainingCompleted: prev.stats.trainingCompleted + 1,
        },
      };
      return saveGameData(next);
    });
  }, []);

  // Initialize 3D WebGL Simulation Engine once
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const engine = new GameSimulationEngine(
      canvasMountRef.current,
      saveData,
      (snapshot) => {
        setHudState(snapshot);
      },
      handleMatchComplete,
      handleTrainingComplete
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dual-Mode Keyboard & Mouse Controls for Desktop & Browser Testing
  useEffect(() => {
    const heldKeys = new Set<string>();
    let isMouseDraggingLook = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const syncKeyboardMovement = () => {
      const eng = engineRef.current;
      if (!eng) return;

      let mx = 0;
      let mz = 0;
      if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) mz += 1;
      if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) mz -= 1;
      if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) mx += 1;
      if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) mx -= 1;

      eng.input.moveX = mx;
      eng.input.moveZ = mz;
      eng.input.sprint =
        heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight');
      eng.input.braking = heldKeys.has('Space') && Boolean(hudState?.inVehicle);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      soundEngine.unlockAudio();
      const eng = engineRef.current;
      if (!eng) return;

      if (e.repeat) return;
      heldKeys.add(e.code);
      syncKeyboardMovement();

      if (e.code === 'Space') {
        if (hudState?.phase === 'deployment') {
          eng.deployFromAircraft();
        } else if (!hudState?.inVehicle) {
          eng.triggerJump();
        }
      } else if (e.code === 'KeyC') {
        eng.toggleCrouch();
      } else if (e.code === 'KeyZ') {
        eng.toggleProne();
      } else if (e.code === 'KeyR') {
        eng.triggerReload();
      } else if (e.code === 'KeyF') {
        if (hudState?.nearVehicle || hudState?.inVehicle) {
          eng.toggleVehicleEnterExit();
        } else {
          eng.pickUpNearbySupply();
        }
      } else if (e.code === 'KeyQ') {
        eng.deployTemporaryCover();
      } else if (e.code === 'Digit1' || e.code === 'Digit2') {
        eng.switchWeaponSlot();
      } else if (e.code === 'Escape') {
        if (hudEditorOpen) {
          setHudEditorOpen(false);
        } else if (hudState && hudState.phase !== 'lobby') {
          eng.setPaused(hudState.phase !== 'paused');
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
      syncKeyboardMovement();
    };

    const onWindowBlur = () => {
      heldKeys.clear();
      const eng = engineRef.current;
      if (eng) {
        eng.input.moveX = 0;
        eng.input.moveZ = 0;
        eng.input.sprint = false;
        eng.input.firing = false;
        eng.input.braking = false;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      soundEngine.unlockAudio();
      if (e.button === 2) {
        isMouseDraggingLook = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDraggingLook || !engineRef.current) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      engineRef.current.rotateCamera(dx * 0.005, dy * 0.004);
    };

    const onMouseUp = () => {
      isMouseDraggingLook = false;
    };

    const onContextMenu = (e: MouseEvent) => {
      if (hudState && hudState.phase !== 'lobby') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, [hudState, hudEditorOpen]);

  const handleUpdateSaveData = (
    updater: (prev: SaveDataSchema) => SaveDataSchema
  ) => {
    setSaveData((prev) => {
      const updated = saveGameData(updater(prev));
      engineRef.current?.updateLobbyCharacter(updated);
      return updated;
    });
  };

  const handleUpdateSettings = (nextSettings: GameSettings) => {
    setSaveData((prev) => {
      const updated = saveGameData({
        ...prev,
        settings: nextSettings,
      });
      engineRef.current?.applyGraphicsSettings(nextSettings);
      return updated;
    });
  };

  const handleResetAllData = () => {
    const fresh = resetAllSaveData();
    setSaveData(fresh);
    engineRef.current?.updateLobbyCharacter(fresh);
    engineRef.current?.applyGraphicsSettings(fresh.settings);
  };

  const handleStartMatch = () => {
    soundEngine.unlockAudio();
    soundEngine.playClick();
    engineRef.current?.startMatch(selectedMode);
  };

  const handleRestartMatch = () => {
    soundEngine.unlockAudio();
    soundEngine.playClick();
    engineRef.current?.startMatch(selectedMode);
  };

  const handleReturnToLobby = () => {
    soundEngine.playClick();
    engineRef.current?.returnToLobby();
  };

  const isInLobby = !hudState || hudState.phase === 'lobby';

  return (
    <main
      onPointerDown={() => soundEngine.unlockAudio()}
      className="relative w-full h-full overflow-hidden bg-[#0B1320] select-none"
    >
      {/* Isolated Three.js WebGL Viewport Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0 w-full h-full" />

      <OfflineIndicator />

      {/* Portrait Orientation Advisory Banner on Mobile */}
      {isPortraitMobile && !dismissedPortraitHint && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#0B1320]/95 border border-[#FF6B1A] rounded-xl px-4 py-2.5 flex items-center gap-3 w-[92%] max-w-sm">
          <Smartphone className="w-5 h-5 text-[#FDE047] rotate-90 shrink-0" />
          <div className="text-xs text-slate-200 flex-1">
            Rotate your phone to <strong>Landscape Orientation</strong> for the
            widest Battle Royale thumb view, or customize controls in{' '}
            <strong>Edit HUD</strong>.
          </div>
          <button
            onClick={() => setDismissedPortraitHint(true)}
            className="px-2.5 py-1 rounded bg-slate-800 text-[11px] font-bold text-white cursor-pointer"
          >
            OK
          </button>
        </div>
      )}

      {/* Main Menu Lobby Overlay OR Active In-Game HUD */}
      {isInLobby ? (
        <MainMenuLobby
          saveData={saveData}
          selectedMode={selectedMode}
          activeScreen={activeLobbyScreen}
          fps={hudState?.fps ?? 60}
          onSelectMode={setSelectedMode}
          onSelectScreen={setActiveLobbyScreen}
          onStartMatch={handleStartMatch}
          onRotateCharacter={(deltaYaw) =>
            engineRef.current?.rotateLobbyCharacter(deltaYaw)
          }
          onUpdateSaveData={handleUpdateSaveData}
          onUpdateSettings={handleUpdateSettings}
          onResetAllData={handleResetAllData}
          onOpenHudEditor={() => setHudEditorOpen(true)}
        />
      ) : (
        hudState && (
          <InGameHUD
            hud={hudState}
            engine={engineRef.current}
            settings={saveData.settings}
            onRestartMatch={handleRestartMatch}
            onReturnToLobby={handleReturnToLobby}
            onOpenHudEditor={() => setHudEditorOpen(true)}
          />
        )
      )}

      {/* Interactive Drag-and-Drop HUD Layout Editor Modal */}
      {hudEditorOpen && (
        <HUDLayoutEditorModal
          settings={saveData.settings}
          onSaveSettings={handleUpdateSettings}
          onClose={() => setHudEditorOpen(false)}
        />
      )}
    </main>
  );
}
