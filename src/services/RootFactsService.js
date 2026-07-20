import { pipeline } from '@huggingface/transformers';
import { TONE_CONFIG } from '../utils/config.js';
import { logError, isWebGPUSupported } from '../utils/common.js';

const MODEL_ID = 'Xenova/LaMini-Flan-T5-248M';

const TONE_STYLES = {
  normal: 'informative and easy to understand',
  funny: 'funny and playful, with a bit of humor',
  professional: 'formal, precise, and scientific',
  casual: 'relaxed and friendly, like chatting with a friend',
};

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = null;
    this.currentBackend = null;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  async loadModel() {
    const candidates = isWebGPUSupported()
      ? [{ device: 'webgpu', dtype: 'q4' }, { device: 'wasm', dtype: 'q4' }]
      : [{ device: 'wasm', dtype: 'q4' }];

    for (const { device, dtype } of candidates) {
      try {
        this.generator = await pipeline('text2text-generation', MODEL_ID, { device, dtype });
        this.currentBackend = device;
        this.config = { device, dtype };
        this.isModelLoaded = true;
        return;
      } catch (error) {
        logError(`Gagal memuat generator pada backend ${device}`, error);
      }
    }

    throw new Error('Gagal memuat model generator fakta');
  }

  setTone(tone) {
    const isAvailable = TONE_CONFIG.availableTones.some((option) => option.value === tone);
    this.currentTone = isAvailable ? tone : TONE_CONFIG.defaultTone;
  }

  async generateFacts(vegetableName) {
    if (!this.isReady() || this.isGenerating) return null;

    this.isGenerating = true;
    try {
      const toneStyle = TONE_STYLES[this.currentTone] ?? TONE_STYLES[TONE_CONFIG.defaultTone];
      const prompt = `Tell me one short fun fact about the vegetable ${vegetableName}. Make it ${toneStyle}.`;

      const output = await this.generator(prompt, {
        max_new_tokens: 80,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.3,
        do_sample: true,
      });

      return output[0]?.generated_text?.trim() || null;
    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }
}