module.exports = {
  testRunner: "jest-circus/runner",
  testTimeout: 5000,
  clearMocks: true,
  coveragePathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/tests"],
  watchPathIgnorePatterns: ["/\\.#.*", "/.*~", "/#.*#"],

  testEnvironment: "node",
  setupFiles: ["<rootDir>/jest.setup.js"],
  transform: {
    //    "^.+\\.tsx?$": "ts-jest",
    "^.+\\.[tj]s$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "js", "json", "node"],
  testPathIgnorePatterns: ["build", "node_modules"],
};
