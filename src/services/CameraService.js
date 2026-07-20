import { logError } from '../utils/common.js';

export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = null;
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  async loadCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === 'videoinput');

    this.config = {
      ...this.config,
      cameras,
      fps: this.config?.fps ?? 30,
    };

    return cameras;
  }

  getConstraints(selectedCameraId) {
    const video = {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: this.config?.fps ?? 30 },
    };

    const isKnownDevice = this.config?.cameras?.some(
      (camera) => camera.deviceId === selectedCameraId,
    );

    if (isKnownDevice) {
      video.deviceId = { exact: selectedCameraId };
    } else {
      video.facingMode = selectedCameraId === 'front' ? 'user' : 'environment';
    }

    return { video, audio: false };
  }

  async startCamera(selectedCameraId) {
    if (!this.video) {
      throw new Error('Elemen video belum disiapkan');
    }

    this.stopCamera();

    this.stream = await navigator.mediaDevices.getUserMedia(this.getConstraints(selectedCameraId));
    this.video.srcObject = this.stream;

    await new Promise((resolve) => {
      this.video.onloadedmetadata = () => resolve();
    });
    await this.video.play();
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }
  }

  setFPS(fps) {
    this.config = { ...this.config, fps };

    const [track] = this.stream?.getVideoTracks() ?? [];
    if (track) {
      track.applyConstraints({ frameRate: { ideal: fps } }).catch((error) => {
        logError('Gagal mengatur FPS kamera', error);
      });
    }
  }

  isActive() {
    return this.stream !== null && this.stream.active;
  }

  isReady() {
    return (
      this.isActive() &&
      this.video !== null &&
      this.video.readyState >= 2 &&
      this.video.videoWidth > 0
    );
  }
}