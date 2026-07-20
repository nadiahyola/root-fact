import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { DetectionService } from './services/DetectionService';
import { CameraService } from './services/CameraService';
import { RootFactsService } from './services/RootFactsService';
import { APP_CONFIG, isValidDetection } from './utils/config';
import { createDelay, getCameraErrorMessage, logError } from './utils/common';

function App() {
  const { state, actions } = useAppState();
  const detectionCleanupRef = useRef(null);
  const isRunningRef = useRef(false);
  const [currentTone, setCurrentTone] = useState('normal');
  const servicesRef = useRef({ detector: null, camera: null, generator: null });

  useEffect(() => {
    const detector = new DetectionService();
    const camera = new CameraService();
    const generator = new RootFactsService();

    servicesRef.current = { detector, camera, generator };
    actions.setServices(servicesRef.current);

    const loadModels = async () => {
      try {
        actions.setModelStatus('Memuat Model AI...');
        await Promise.all([
          detector.loadModel((progress) => {
            actions.setModelProgress(progress);
          }),
          generator.loadModel(),
        ]);
        await camera.loadCameras();
        actions.setModelStatus('Model AI Siap');
        actions.setModelProgress(100);
      } catch (error) {
        logError('Gagal memuat model', error);
        actions.setModelStatus('Model Gagal Dimuat');
        actions.setError('Gagal memuat model AI. Muat ulang halaman untuk mencoba lagi.');
        actions.setModelProgress(0);
      }
    };
    loadModels();

    return () => {
      detectionCleanupRef.current?.();
      camera.stopCamera();
    };
  }, [actions]);

  const startDetectionLoop = useCallback(() => {
    const { detector, camera, generator } = servicesRef.current;
    let cancelled = false;
    let timeoutId = null;

    detectionCleanupRef.current = () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };

    const detectFrame = async () => {
      if (cancelled || !isRunningRef.current) return;

      try {
        if (camera.isReady()) {
          const result = await detector.predict(camera.video);

          if (!cancelled && isValidDetection(result)) {
            actions.setDetectionResult(result);
            actions.setAppState('result');
            actions.setFunFactData(null);

            let fact = null;
            try {
              [fact] = await Promise.all([
                generator.generateFacts(result.className),
                createDelay(APP_CONFIG.factsGenerationDelay),
              ]);
            } catch (error) {
              logError('Gagal menghasilkan fakta', error);
            }

            if (!cancelled) actions.setFunFactData(fact || 'error');
            return;
          }
        }
      } catch (error) {
        logError('Gagal melakukan deteksi', error);
      }

      timeoutId = setTimeout(detectFrame, APP_CONFIG.detectionRetryInterval);
    };

    actions.setAppState('analyzing');
    timeoutId = setTimeout(detectFrame, APP_CONFIG.analyzingDelay);
  }, [actions]);

  const handleToggleCamera = useCallback(async () => {
    const { camera } = servicesRef.current;
    if (!camera) return;

    if (isRunningRef.current) {
      detectionCleanupRef.current?.();
      camera.stopCamera();
      isRunningRef.current = false;
      actions.setRunning(false);
      actions.resetResults();
      return;
    }

    try {
      actions.resetResults();
      await camera.startCamera();
      isRunningRef.current = true;
      actions.setRunning(true);
      startDetectionLoop();
    } catch (error) {
      logError('Gagal memulai kamera', error);
      actions.setError(getCameraErrorMessage(error));
    }
  }, [actions, startDetectionLoop]);

  const handleToneChange = useCallback((tone) => {
    setCurrentTone(tone);
    servicesRef.current.generator?.setTone(tone);
  }, []);

  const handleCopyFact = useCallback(async () => {
    const fact = state.funFactData;
    if (!fact || fact === 'error') return;

    try {
      await navigator.clipboard.writeText(fact);
    } catch (error) {
      logError('Gagal menyalin fakta', error);
      actions.setError('Gagal menyalin fakta ke clipboard');
    }
  }, [state.funFactData, actions]);

  return (
    <div className="app-container">
      <Header
        modelStatus={state.modelStatus}
        modelProgress={state.modelProgress}
      />

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          onToggleCamera={handleToggleCamera}
          onToneChange={handleToneChange}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopyFact={handleCopyFact}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js & Transformers.js</p>
      </footer>

      {state.error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;