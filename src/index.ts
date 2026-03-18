import { ESLint } from 'eslint'
import { noUnusedTypePropertiesRule } from './rules/no-unused-type-properties.js'

export const rules: NonNullable<ESLint.Plugin['rules']> = {
  'no-unused-type-properties': noUnusedTypePropertiesRule,
}

const plugin: ESLint.Plugin = {
  meta: {
    name: 'eslint-plugin-no-unused-type-properties',
    version: '0.1.1',
  },
  rules,
}

export default plugin
