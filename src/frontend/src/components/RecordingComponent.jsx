import React, { useState, useRef, useEffect } from 'react';
import './RecordingComponent.css';

export function RecordingComponent({ onRecordingComplete, questionNumber = null }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioURL, setAudioURL] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);

        // Call completion handler with blob
        onRecordingComplete({
          blob: audioBlob,
          duration: recordingTime,
          url,
        });

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((time) => time + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="recording-component">
      <div className="recording-header">
        {questionNumber && <h3>Question {questionNumber}</h3>}
        <div className="recording-timer">{formatTime(recordingTime)}</div>
      </div>

      <div className={`recording-status ${isRecording ? 'recording' : ''}`}>
        {isRecording && <div className="recording-indicator"></div>}
        <span>{isRecording ? 'Recording...' : 'Ready to record'}</span>
      </div>

      <div className="recording-controls">
        {!isRecording ? (
          <button className="btn btn-primary" onClick={startRecording}>
            🎤 Start Recording
          </button>
        ) : (
          <button className="btn btn-danger" onClick={stopRecording}>
            ⏹ Stop Recording
          </button>
        )}
      </div>

      {audioURL && (
        <div className="recording-playback">
          <p>Recording saved</p>
          <audio src={audioURL} controls style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
}
