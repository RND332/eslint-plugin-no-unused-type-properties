# eslint-plugin-no-unused-type-properties

Standalone ESLint plugin providing the `no-unused-type-properties` rule.

## Usage (flat config)

```ts
import pluginNoUnusedTypeProperties from 'eslint-plugin-no-unused-type-properties'

export default [
  {
    plugins: {
      random: pluginNoUnusedTypeProperties,
    },
    rules: {
      'random/no-unused-type-properties': 'error',
    },
  },
]
```
# eslint-plugin-no-unused-type-properties
