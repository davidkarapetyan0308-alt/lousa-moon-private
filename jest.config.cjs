module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  collectCoverageFrom: [
    'src/services/cyclePrediction.ts',
    'src/services/deliveryPlanning.ts',
    'src/services/boxRecommendation.ts',
    'src/services/notificationPolicy.ts',
    'src/services/engagement.ts',
    'src/services/productAnalytics.ts',
  ],
};
