import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [
  { ignores: [".next/**", ".next-dev/**", "out/**", "build/**", "next-env.d.ts", "design/**", ".orchestration/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
