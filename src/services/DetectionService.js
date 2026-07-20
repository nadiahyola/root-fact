import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { logError, isWebGPUSupported, validateModelMetadata } from '../utils/common.js';

const MODEL_URL = '/model/model.json';
const METADATA_URL = '/model/metadata.json';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = null;
  }

  async loadModel(onProgress = () => { }) {
    const update = (progress, message) => {
      onProgress(progress, message);
    };

    try {
      update(0, 'Initializing TensorFlow...');

      const backends = isWebGPUSupported()
        ? ['webgpu', 'webgl', 'cpu']
        : ['webgl', 'cpu'];

      let backendSelected = false;

      for (const backendName of backends) {
        try {
          update(10, `Initializing ${backendName.toUpperCase()} backend...`);

          await tf.setBackend(backendName);
          await tf.ready();

          backendSelected = true;
          break;
        } catch (error) {
          logError(`Failed to use backend ${backendName}`, error);
        }
      }

      if (!backendSelected) {
        throw new Error('No TensorFlow backend available');
      }

      update(30, 'Loading detection model...');

      const [model, metadataResponse] = await Promise.all([
        tf.loadLayersModel(MODEL_URL),
        fetch(METADATA_URL),
      ]);

      update(60, 'Reading model metadata...');

      const metadata = await metadataResponse.json();

      if (!validateModelMetadata(metadata)) {
        throw new Error('Metadata model tidak valid');
      }

      this.model = model;
      this.labels = metadata.labels;
      this.config = {
        backend: tf.getBackend(),
        imageSize: metadata.imageSize ?? 224,
      };

      update(80, 'Optimizing AI model...');

      tf.tidy(() => {
        const input = tf.zeros([
          1,
          this.config.imageSize,
          this.config.imageSize,
          3,
        ]);

        this.model.predict(input);
      });

      update(95, 'Finalizing...');

      await new Promise(resolve => setTimeout(resolve, 250));

      update(100, 'Detection model ready');
    } catch (error) {
      update(0, 'Failed');
      throw error;
    }
  }

  async predict(imageElement) {
    if (!this.isLoaded()) return null;

    const scores = tf.tidy(() => {
      const input = tf.browser.fromPixels(imageElement)
        .resizeNearestNeighbor([this.config.imageSize, this.config.imageSize])
        .toFloat()
        .div(127.5)
        .sub(1)
        .expandDims(0);

      return this.model.predict(input).dataSync();
    });

    let bestIndex = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[bestIndex]) bestIndex = i;
    }

    const score = scores[bestIndex];
    return {
      className: this.labels[bestIndex],
      score,
      confidence: score * 100,
      isValid: true,
    };
  }

  isLoaded() {
    return this.model !== null && this.labels.length > 0;
  }
}