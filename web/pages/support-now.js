import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from '../styles/SupportNow.module.css';

export default function SupportNow() {
  const router = useRouter();
  
  // State machine: 'setup' | 'starting' | 'session' | 'paused' | 'complete'
  const [state, setState] = useState('setup');
  
  // Setup inputs
  const [duration, setDuration] = useState(2);
  const [track, setTrack] = useState('');
  const [intensity, setIntensity] = useState(null);
  const [context, setContext] = useState(null);
  
  // Session data
  const [protocol, setProtocol] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepTimeRemaining, setStepTimeRemaining] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [urgeRating, setUrgeRating] = useState(null);
  
  // Refs
  const timerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const audioRef = useRef(null);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);
  
  // Timer logic
  useEffect(() => {
    if (state === 'session' && stepTimeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setStepTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-advance to next step
            playChime();
            if (currentStepIndex < protocol.steps.length - 1) {
              setCurrentStepIndex(currentStepIndex + 1);
              return protocol.steps[currentStepIndex + 1].seconds;
            } else {
              // Session complete
              setState('complete');
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [state, stepTimeRemaining, currentStepIndex, protocol]);
  
  const playChime = () => {
    if (audioEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {}); // Ignore autoplay errors
    }
  };
  
  const startSession = async () => {
    if (!track) {
      alert('Please select a track');
      return;
    }
    
    setState('starting');
    
    // Create abort controller for fetch
    abortControllerRef.current = new AbortController();
    
    // Show starting screen for 10 seconds while fetching
    const startTime = Date.now();
    
    try {
      const response = await fetch('/api/support-now/protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMinutes: duration,
          track,
          intensity,
          context
        }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate protocol');
      }
      
      const data = await response.json();
      
      // Ensure at least 10 seconds of "starting" screen
      const elapsed = Date.now() - startTime;
      if (elapsed < 10000) {
        await new Promise(resolve => setTimeout(resolve, 10000 - elapsed));
      }
      
      setProtocol(data);
      setCurrentStepIndex(0);
      setStepTimeRemaining(data.steps[0].seconds);
      setState('session');
      playChime();
      
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Error fetching protocol:', error);
      alert('Failed to start session. Please try again.');
      setState('setup');
    }
  };
  
  const pauseSession = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState('paused');
  };
  
  const resumeSession = () => {
    setState('session');
  };
  
  const restartSession = () => {
    setCurrentStepIndex(0);
    if (protocol) {
      setStepTimeRemaining(protocol.steps[0].seconds);
    }
    setState('session');
  };
  
  const endSession = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setState('complete');
  };
  
  const skipStep = () => {
    if (currentStepIndex < protocol.steps.length - 1) {
      playChime();
      setCurrentStepIndex(currentStepIndex + 1);
      setStepTimeRemaining(protocol.steps[currentStepIndex + 1].seconds);
    } else {
      setState('complete');
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Render functions for each state
  const renderSetup = () => (
    <div className={styles.setupCard}>
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>Support Now</h1>
        <p className={styles.cardSubtitle}>Quick guided session to help you through this moment</p>
      </div>
      
      <div className={styles.inputSection}>
        <label className={styles.inputLabel}>Session Duration</label>
        <div className={styles.segmentedControl}>
          <button
            className={`${styles.segmentButton} ${duration === 2 ? styles.active : ''}`}
            onClick={() => setDuration(2)}
          >
            2 min
          </button>
          <button
            className={`${styles.segmentButton} ${duration === 5 ? styles.active : ''}`}
            onClick={() => setDuration(5)}
          >
            5 min
          </button>
        </div>
      </div>
      
      <div className={styles.inputSection}>
        <label className={styles.inputLabel}>Primary Track</label>
        <div className={styles.chipGroup}>
          {['Porn', 'Sex', 'Food'].map(t => (
            <button
              key={t}
              className={`${styles.chip} ${track === t.toLowerCase() ? styles.active : ''}`}
              onClick={() => setTrack(t.toLowerCase())}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      
      <div className={styles.optionalSection}>
        <div className={styles.optionalHeader}>Optional (takes 2 seconds)</div>
        
        <div className={styles.sliderGroup}>
          <div className={styles.sliderLabel}>
            <span>Urge Intensity</span>
            <span className={styles.sliderValue}>{intensity || 5}/10</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={intensity || 5}
            onChange={(e) => setIntensity(parseInt(e.target.value))}
            className={styles.slider}
          />
        </div>
        
        <div>
          <div className={styles.sliderLabel}>
            <span>Where are you?</span>
          </div>
          <div className={styles.contextChips}>
            {['Home', 'Out', 'Bed'].map(c => (
              <button
                key={c}
                className={`${styles.contextChip} ${context === c.toLowerCase() ? styles.active : ''}`}
                onClick={() => setContext(context === c.toLowerCase() ? null : c.toLowerCase())}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className={styles.audioToggle}>
        <label>
          <input
            type="checkbox"
            checked={audioEnabled}
            onChange={(e) => setAudioEnabled(e.target.checked)}
          />
          <span>Soft audio cues</span>
        </label>
      </div>
      
      <button 
        className={styles.startButton}
        onClick={startSession}
        disabled={!track}
      >
        Start Guided Session
      </button>
      
      <Link href="/" className={styles.backLink}>â† Back to home</Link>
    </div>
  );
  
  const renderStarting = () => (
    <div className={styles.startingContainer}>
      <div className={styles.pulseAnimation}>
        <div className={styles.pulseRing}></div>
        <div className={styles.pulseRing}></div>
        <div className={styles.pulseRing}></div>
      </div>
      <h2 className={styles.startingTitle}>Starting your session...</h2>
      <p className={styles.startingSubtitle}>Take a deep breath</p>
    </div>
  );
  
  const renderSession = () => {
    const currentStep = protocol.steps[currentStepIndex];
    
    return (
      <div className={styles.sessionCard}>
        <div className={styles.sessionHeader}>
          <div className={styles.stepCounter}>
            Step {currentStepIndex + 1} of {protocol.steps.length}
          </div>
          <button className={styles.pauseButton} onClick={pauseSession}>
            â¸ Pause
          </button>
        </div>
        
        <div className={styles.stepContent}>
          <div className={styles.timerDisplay}>
            {formatTime(stepTimeRemaining)}
          </div>
          
          <h2 className={styles.stepTitle}>{currentStep.title}</h2>
          <p className={styles.stepInstruction}>{currentStep.instruction}</p>
          
          {currentStep.category && (
            <div className={styles.stepCategory}>{currentStep.category}</div>
          )}
        </div>
        
        <div className={styles.sessionFooter}>
          <button className={styles.skipButton} onClick={skipStep}>
            Skip step â†’
          </button>
        </div>
        
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill}
            style={{ width: `${((currentStepIndex + 1) / protocol.steps.length) * 100}%` }}
          ></div>
        </div>
      </div>
    );
  };
  
  const renderPauseModal = () => (
    <div className={styles.modalOverlay}>
      <div className={styles.pauseModal}>
        <h2>Session Paused</h2>
        <p>Take your time. What would you like to do?</p>
        
        <div className={styles.modalActions}>
          <button className={`${styles.modalButton} ${styles.primary}`} onClick={resumeSession}>
            Resume
          </button>
          <button className={`${styles.modalButton} ${styles.secondary}`} onClick={restartSession}>
            Restart Session
          </button>
          <button className={`${styles.modalButton} ${styles.tertiary}`} onClick={endSession}>
            End Session
          </button>
        </div>
      </div>
    </div>
  );
  
  const renderComplete = () => (
    <div className={styles.completeCard}>
      <div className={styles.completeIcon}>âœ“</div>
      <h2 className={styles.completeTitle}>Well Done</h2>
      <p className={styles.completeSubtitle}>You completed the session</p>
      
      <div className={styles.ratingSection}>
        <label className={styles.ratingLabel}>How's your urge now?</label>
        <div className={styles.ratingButtons}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button
              key={n}
              className={`${styles.ratingButton} ${urgeRating === n ? styles.active : ''}`}
              onClick={() => setUrgeRating(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      
      <div className={styles.completeActions}>
        <button className={`${styles.completeButton} ${styles.primary}`} onClick={() => router.push('/login')}>
          Login to Pin Steps (150 tokens)
        </button>
        <button className={`${styles.completeButton} ${styles.secondary}`} onClick={() => {
          setState('setup');
          setProtocol(null);
          setCurrentStepIndex(0);
          setUrgeRating(null);
        }}>
          Run Again
        </button>
        <Link href="/" className={styles.completeLink}>
          Return to Home
        </Link>
      </div>
    </div>
  );
  
  return (
    <>
      <audio ref={audioRef} src="/sounds/chime.mp3" preload="auto" />
      
      <div className={styles.supportNowContainer}>
        {state === 'setup' && renderSetup()}
        {state === 'starting' && renderStarting()}
        {state === 'session' && renderSession()}
        {state === 'paused' && renderPauseModal()}
        {state === 'complete' && renderComplete()}
      </div>
    </>
  );
}
