export default {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['accessibility', 'performance', 'best-practices', 'seo'],
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },
  // Accessibility thresholds
  assertions: {
    'categories:accessibility': ['error', { minScore: 0.9 }], // WCAG AA minimum
    'categories:performance': ['warn', { minScore: 0.85 }],
    'categories:best-practices': ['warn', { minScore: 0.9 }],
  },
};
