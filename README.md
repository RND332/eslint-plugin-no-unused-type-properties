# eslint-plugin-no-unused-type-properties

Standalone ESLint plugin providing the `no-unused-type-properties` rule.

## Install

```sh
npm install --save-dev eslint eslint-plugin-no-unused-type-properties @typescript-eslint/parser
```

## Usage (flat config)

```ts
import pluginNoUnusedTypeProperties from 'eslint-plugin-no-unused-type-properties'
import tsParser from '@typescript-eslint/parser'

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      typeProps: pluginNoUnusedTypeProperties,
    },
    rules: {
      'typeProps/no-unused-type-properties': 'error',
    },
  },
]
```

## Examples

### Fails

```ts
interface User {
  id: string
  name: string
}

function greet({ id }: User) {
  return id
}
```

This reports `name` because it exists on `User` but is missing from the destructuring pattern.

```ts
interface RequestContext {
  user: {
    id: string
    name: string
  }
  traceId: string
}

function handle({ user: { id }, traceId }: RequestContext) {
  return id + traceId
}
```

This reports `user.name` because nested object patterns are checked too.

### Passes

```ts
interface User {
  id: string
  name: string
}

function greet({ id, name }: User) {
  return id + name
}
```

```ts
interface User {
  id: string
  name: string
  email: string
}

const serialize = ({ id, ...rest }: User) => ({ id, rest })
```

Rest patterns are allowed because the remaining properties are still captured.
