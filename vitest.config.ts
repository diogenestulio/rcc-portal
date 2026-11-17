import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/empty.ts") } },
  test: {
    // Só a pasta tests/: o build "standalone" copia os testes para .next/ e eles não devem rodar de novo.
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: process.env.SKIP_DB_RESET ? [] : ["tests/global-setup.ts"],
    fileParallelism: false, // um único banco de teste compartilhado
    testTimeout: 30_000,
    env: {
      APP_ENV: "development",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres:dev_only_pw@127.0.0.1:55432/rcc_test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234", // gitleaks:allow (valor fictício de teste)
      APP_SIGNING_KEY: "test-signing-key-test-signing-key-123456", // gitleaks:allow (valor fictício de teste)
    },
  },
});
