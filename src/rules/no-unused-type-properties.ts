/* eslint-disable unicorn/no-array-callback-reference */
import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types'
import type { TSESLint } from '@typescript-eslint/utils'
import { createRule } from '../utils/create-rule'

type MessageIds = 'unusedProperties'

function isProperty(
  property: TSESTree.Property | TSESTree.RestElement,
): property is TSESTree.Property {
  return property.type === AST_NODE_TYPES.Property
}

function isObjectPattern(param: TSESTree.Parameter): param is TSESTree.ObjectPattern {
  return param.type === AST_NODE_TYPES.ObjectPattern
}

function isTypeAliasDeclaration(
  item: TSESTree.ProgramStatement,
): item is TSESTree.TSTypeAliasDeclaration {
  return item.type === AST_NODE_TYPES.TSTypeAliasDeclaration
}

function getTypeAliasDeclaration(
  item: TSESTree.ProgramStatement,
): TSESTree.TSTypeAliasDeclaration | undefined {
  if (isTypeAliasDeclaration(item)) {
    return item
  }

  if (
    item.type === AST_NODE_TYPES.ExportNamedDeclaration &&
    item.declaration &&
    item.declaration.type === AST_NODE_TYPES.TSTypeAliasDeclaration
  ) {
    return item.declaration
  }

  return undefined
}

function isInterfaceDeclaration(
  item: TSESTree.ProgramStatement,
): item is TSESTree.TSInterfaceDeclaration {
  return item.type === AST_NODE_TYPES.TSInterfaceDeclaration
}

function getInterfaceDeclaration(
  item: TSESTree.ProgramStatement,
): TSESTree.TSInterfaceDeclaration | undefined {
  if (isInterfaceDeclaration(item)) {
    return item
  }

  if (
    item.type === AST_NODE_TYPES.ExportNamedDeclaration &&
    item.declaration &&
    item.declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration
  ) {
    return item.declaration
  }

  return undefined
}

export const noUnusedTypePropertiesRule = createRule<[], MessageIds>({
  name: 'no-unused-type-properties',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallows unused type properties for destructured function arguments',
      recommended: false,
      requiresTypeChecking: false,
    },
    messages: {
      unusedProperties:
        "Property '{{propertyName}}' is defined in type '{{typeName}}' but is not used in the destructuring. Remove it or use Omit<{{typeName}}, '{{propertyName}}'> to explicitly exclude it.",
    },
    schema: [],
  },
  defaultOptions: [],

  create(context: Readonly<TSESLint.RuleContext<MessageIds, []>>) {
    const checkIfPropertyIsPresent =
      (objectPattern: TSESTree.ObjectPattern, typeName: string) =>
      (typeProperty: TSESTree.TypeElement): void => {
        if (typeProperty.type !== AST_NODE_TYPES.TSPropertySignature) {
          return
        }

        if (typeProperty.key.type !== AST_NODE_TYPES.Identifier) {
          return
        }

        const propertyName = typeProperty.key.name
        const properties = objectPattern.properties.filter(isProperty)

        const property = properties.find(
          property =>
            property.key.type === AST_NODE_TYPES.Identifier && property.key.name === propertyName,
        )
        if (!property) {
          context.report({
            node: objectPattern,
            messageId: 'unusedProperties',
            data: {
              propertyName,
              typeName,
            },
          })
          return
        }

        if (typeProperty.typeAnnotation && property.value.type === AST_NODE_TYPES.ObjectPattern) {
          recursiveCheck(property.value, typeProperty.typeAnnotation)
        }
      }

    const recursiveCheck = (
      object: TSESTree.ObjectPattern,
      type: TSESTree.TSTypeAnnotation,
    ): void => {
      const restElement = object.properties.find(
        property => property.type === AST_NODE_TYPES.RestElement,
      )
      if (restElement) {
        return
      }

      if (
        type.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
        type.typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier
      ) {
        const typeName = type.typeAnnotation.typeName.name

        const typeDeclaration = context.sourceCode.ast.body
          .map(getTypeAliasDeclaration)
          .find(
            (decl): decl is TSESTree.TSTypeAliasDeclaration =>
              decl !== undefined && decl.id.name === typeName,
          )

        if (typeDeclaration) {
          if (typeDeclaration.typeAnnotation.type !== AST_NODE_TYPES.TSTypeLiteral) {
            return
          }
          typeDeclaration.typeAnnotation.members.forEach(checkIfPropertyIsPresent(object, typeName))
          return
        }

        const interfaceDeclaration = context.sourceCode.ast.body
          .map(getInterfaceDeclaration)
          .find(
            (decl): decl is TSESTree.TSInterfaceDeclaration =>
              decl !== undefined && decl.id.name === typeName,
          )

        if (!interfaceDeclaration) {
          return
        }

        interfaceDeclaration.body.body.forEach(checkIfPropertyIsPresent(object, typeName))

        return
      }

      if (type.typeAnnotation.type === AST_NODE_TYPES.TSTypeLiteral) {
        const inlineTypeName = context.sourceCode.getText(type.typeAnnotation)
        type.typeAnnotation.members.forEach(checkIfPropertyIsPresent(object, inlineTypeName))
      }
    }

    const checkParameter = (paramObjectPattern: TSESTree.ObjectPattern): void => {
      if (!paramObjectPattern.typeAnnotation) {
        return
      }
      recursiveCheck(paramObjectPattern, paramObjectPattern.typeAnnotation)
    }

    return {
      FunctionDeclaration(node: TSESTree.FunctionDeclaration) {
        node.params.filter(isObjectPattern).forEach(checkParameter)
      },

      ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression) {
        node.params.filter(isObjectPattern).forEach(checkParameter)
      },

      FunctionExpression(node: TSESTree.FunctionExpression) {
        node.params.filter(isObjectPattern).forEach(checkParameter)
      },
    }
  },
})
