import { noUnusedTypePropertiesRule } from './rules/no-unused-type-properties'

export const rules = {
  'no-unused-type-properties': noUnusedTypePropertiesRule,
}

const plugin = {
  meta: {
    name: 'eslint-plugin-unused-type-properties',
    version: '1.0.0',
  },
  rules: {
    'no-unused-type-properties': noUnusedTypePropertiesRule, 
  }
} satisfies {
  meta: {
    name: string
    version: string
  }
  rules: Record<string, typeof noUnusedTypePropertiesRule>
}

export default plugin
