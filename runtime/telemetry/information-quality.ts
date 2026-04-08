/**
 * Information Quality Analyzer
 *
 * Analyzes information quality based on Information Theory
 * Implements entropy calculation, density analysis, and SNR estimation
 */

import type { InformationQualityMetrics } from './types';

export class InformationQualityAnalyzer {
  private readonly DEFAULT_ALPHABET_SIZE = 256;

  /**
   * Analyze content and return information quality metrics
   */
  analyze(content: string): InformationQualityMetrics {
    const tokens = this.tokenize(content);
    const entropy = this.calculateEntropy(tokens);
    const maxEntropy = this.calculateMaxEntropy(tokens.length);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

    const tokenCount = tokens.length;
    const informationDensity = tokenCount > 0 ? entropy / tokenCount : 0;

    const signalToNoiseRatio = this.estimateSNR(content, tokens);
    const noiseLevel = 1 - signalToNoiseRatio;

    const confidenceScore = this.estimateConfidence(content);
    const confidenceCalibration = this.calculateCalibration(confidenceScore);

    const redundancyRatio = 1 - normalizedEntropy;
    const compressionPotential = redundancyRatio;

    return {
      entropy,
      maxEntropy,
      normalizedEntropy,
      informationDensity,
      tokenEfficiency: informationDensity,
      signalToNoiseRatio,
      noiseLevel,
      confidenceScore,
      confidenceCalibration,
      redundancyRatio,
      compressionPotential,
    };
  }

  /**
   * Calculate Shannon entropy of the content
   * H(X) = -Σ p(x) * log2(p(x))
   */
  calculateEntropy(tokens: string[]): number {
    if (tokens.length === 0) return 0;

    const frequencyMap = new Map<string, number>();
    for (const token of tokens) {
      frequencyMap.set(token, (frequencyMap.get(token) || 0) + 1);
    }

    let entropy = 0;
    const totalTokens = tokens.length;

    for (const count of frequencyMap.values()) {
      const probability = count / totalTokens;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Calculate maximum possible entropy for given token count
   */
  calculateMaxEntropy(tokenCount: number): number {
    if (tokenCount === 0) return 0;
    // Max entropy occurs when all tokens are unique
    return Math.log2(Math.min(tokenCount, this.DEFAULT_ALPHABET_SIZE));
  }

  /**
   * Estimate signal-to-noise ratio
   * Signal = meaningful content (code, structured data)
   * Noise = redundancy, filler words, formatting
   */
  private estimateSNR(content: string, tokens: string[]): number {
    if (tokens.length === 0) return 1;

    // Count signal indicators
    const signalIndicators = [
      // Code patterns
      /\b(function|class|const|let|var|if|else|for|while|return)\b/g,
      // Structured data
      /\b(true|false|null|undefined|\d+)\b/g,
      // Identifiers (camelCase, snake_case)
      /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g,
    ];

    let signalCount = 0;
    for (const pattern of signalIndicators) {
      const matches = content.match(pattern);
      if (matches) {
        signalCount += matches.length;
      }
    }

    // Noise indicators
    const noiseIndicators = [
      // Repeated words
      /\b(very|really|actually|basically|literally)\b/gi,
      // Filler punctuation
      /[!?]{2,}/g,
      // Excessive whitespace
      /\s{3,}/g,
    ];

    let noiseCount = 0;
    for (const pattern of noiseIndicators) {
      const matches = content.match(pattern);
      if (matches) {
        noiseCount += matches.length;
      }
    }

    // Calculate SNR
    const total = signalCount + noiseCount;
    if (total === 0) return 1;

    return Math.min(1, signalCount / total);
  }

  /**
   * Estimate confidence score based on content characteristics
   */
  private estimateConfidence(content: string): number {
    let score = 0.5; // Base confidence

    // Increase confidence for structured content
    if (/\{[\s\S]*\}/.test(content)) score += 0.1; // JSON-like
    if (/\[[\s\S]*\]/.test(content)) score += 0.05; // Arrays
    if (/\b(true|false|null|\d+)\b/.test(content)) score += 0.1; // Structured values

    // Increase confidence for explicit statements
    if (/\b(definitely|certainly|always|never)\b/gi.test(content)) score += 0.05;

    // Decrease confidence for uncertainty
    if (/\b(maybe|perhaps|possibly|might|could be)\b/gi.test(content)) score -= 0.1;
    if (/\b(I think|I believe|probably|likely)\b/gi.test(content)) score -= 0.05;

    // Decrease confidence for questions
    const questionCount = (content.match(/\?/g) || []).length;
    score -= questionCount * 0.02;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate confidence calibration
   * How well does the confidence score match actual accuracy
   */
  private calculateCalibration(confidence: number): number {
    // Simplified calibration - in practice, this would compare
    // predicted confidence with actual outcomes over time
    return confidence;
  }

  /**
   * Tokenize content into tokens
   * Simple implementation - can be enhanced with proper tokenizer
   */
  private tokenize(content: string): string[] {
    // Split on whitespace and punctuation
    return content
      .toLowerCase()
      .split(/\s+|[.,!?;:'"(){}[\]]+/)
      .filter(token => token.length > 0);
  }

  /**
   * Calculate compression ratio
   */
  calculateCompressionRatio(original: string, compressed: string): number {
    if (original.length === 0) return 1;
    return compressed.length / original.length;
  }

  /**
   * Detect redundant information
   */
  detectRedundancy(content: string): {
    repeatedPhrases: string[];
    redundancyScore: number;
  } {
    const tokens = this.tokenize(content);
    const phraseCounts = new Map<string, number>();

    // Count 3-grams
    for (let i = 0; i < tokens.length - 2; i++) {
      const phrase = tokens.slice(i, i + 3).join(' ');
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }

    const repeatedPhrases: string[] = [];
    let redundantCount = 0;

    for (const [phrase, count] of phraseCounts) {
      if (count > 1) {
        repeatedPhrases.push(phrase);
        redundantCount += count - 1;
      }
    }

    const redundancyScore = tokens.length > 0 ? redundantCount / tokens.length : 0;

    return {
      repeatedPhrases,
      redundancyScore,
    };
  }

  /**
   * Generate optimization suggestions based on analysis
   */
  generateSuggestions(metrics: InformationQualityMetrics): string[] {
    const suggestions: string[] = [];

    if (metrics.normalizedEntropy < 0.5) {
      suggestions.push('Content has low entropy - consider adding more diverse information');
    }

    if (metrics.informationDensity < 0.001) {
      suggestions.push('Low information density - consider compressing or restructuring content');
    }

    if (metrics.signalToNoiseRatio < 0.7) {
      suggestions.push('High noise level detected - consider removing filler words and redundant phrases');
    }

    if (metrics.confidenceScore < 0.6) {
      suggestions.push('Low confidence indicators detected - consider adding more specific or certain statements');
    }

    if (metrics.redundancyRatio > 0.5) {
      suggestions.push('High redundancy detected - consider compressing repeated information');
    }

    return suggestions;
  }
}
