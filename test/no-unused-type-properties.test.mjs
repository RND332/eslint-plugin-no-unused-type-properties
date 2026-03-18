import test from 'node:test'
import assert from 'node:assert/strict'
import tsParser from '@typescript-eslint/parser'
import { ESLint } from 'eslint'
import plugin from '../dist/index.js'

async function lint(code) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    ignore: false,
    overrideConfig: [
      {
        files: ['**/*.ts'],
        languageOptions: {
          parser: tsParser,
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
        plugins: {
          local: plugin,
        },
        rules: {
          'local/no-unused-type-properties': 'error',
        },
      },
    ],
  })

  const [result] = await eslint.lintText(code, { filePath: 'fixture.ts' })
  return result.messages
}

test('accepts destructuring that uses every interface property', async () => {
  const messages = await lint(`
    interface User {
      id: string
      name: string
    }

    function greet({ id, name }: User) {
      return id + name
    }
  `)

  assert.equal(messages.length, 0)
})

test('accepts rest destructuring because remaining properties are preserved', async () => {
  const messages = await lint(`
    interface User {
      id: string
      name: string
      email: string
    }

    const serialize = ({ id, ...rest }: User) => ({ id, rest })
  `)

  assert.equal(messages.length, 0)
})

test('reports interface properties that are not destructured', async () => {
  const messages = await lint(`
    interface User {
      id: string
      name: string
    }

    function greet({ id }: User) {
      return id
    }
  `)

  assert.equal(messages.length, 1)
  assert.equal(messages[0].ruleId, 'local/no-unused-type-properties')
  assert.equal(
    messages[0].message,
    'Property \'name\' is defined in type \'User\' but is not used in the destructuring. Remove it from the destructuring pattern or use Omit<User, "name"> to explicitly exclude it.',
  )
})

test('reports missing properties for inline object types', async () => {
  const messages = await lint(`
    const greet = ({ id }: { id: string; name: string }) => id
  `)

  assert.equal(messages.length, 1)
  assert.equal(
    messages[0].message,
    'Property \'name\' is defined in type \'(inline type)\' but is not used in the destructuring. Remove it from the destructuring pattern or use Omit<(inline type), "name"> to explicitly exclude it.',
  )
})

test('reports nested properties when a nested object pattern omits fields', async () => {
  const messages = await lint(`
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
  `)

  assert.equal(messages.length, 1)
  assert.equal(
    messages[0].message,
    'Property \'name\' is defined in type \'RequestContext.user\' but is not used in the destructuring. Remove it from the destructuring pattern or use Omit<RequestContext.user, "name"> to explicitly exclude it.',
  )
})