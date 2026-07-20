import { Sprout } from 'lucide-react';

function Header({ modelStatus, modelProgress }) {
  const isModelReady = modelStatus === 'Model AI Siap';

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Sprout size={20} />
          <span>RootFacts</span>
        </div>

        <div className="status-pill">
          <div className="status-header">
            <span className={`status-dot ${isModelReady ? 'active' : ''}`} />
            <span>{modelStatus}</span>
          </div>

          {!isModelReady && (
            <div className="status-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${modelProgress}%`,
                  }}
                />
              </div>

              <span className="progress-text">
                {Math.round(modelProgress)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </header >
  );
}

export default Header;
