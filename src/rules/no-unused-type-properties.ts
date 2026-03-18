import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types';
import type { ESLint } from 'eslint';

type MessageIds = 'unusedProperties';

type PluginRule = NonNullable<ESLint.Plugin['rules']>[string];

function isObjectPattern(node: unknown): node is TSESTree.ObjectPattern {
  return !!node && typeof node === 'object' && 'type' in node && node.type === AST_NODE_TYPES.ObjectPattern;
}

function isProperty(
  prop: TSESTree.Property | TSESTree.RestElement,
): prop is TSESTree.Property {
  return prop.type === AST_NODE_TYPES.Property;
}

function isExportNamedDeclaration(node: unknown): node is TSESTree.ExportNamedDeclaration {
  return !!node && typeof node === 'object' && 'type' in node && node.type === AST_NODE_TYPES.ExportNamedDeclaration;
}

function isNamedTypeDeclaration(
  node: unknown,
): node is TSESTree.TSTypeAliasDeclaration | TSESTree.TSInterfaceDeclaration {
  return (
    !!node
    && typeof node === 'object'
    && 'type' in node
    && (node.type === AST_NODE_TYPES.TSTypeAliasDeclaration
      || node.type === AST_NODE_TYPES.TSInterfaceDeclaration)
  );
}

function isProgram(node: unknown): node is TSESTree.Program {
  return !!node && typeof node === 'object' && 'type' in node && node.type === AST_NODE_TYPES.Program;
}

export const noUnusedTypePropertiesRule: PluginRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallows unused properties in destructured function parameters typed with interfaces or type aliases',
      url: 'https://typescript-eslint.io/rules/no-unused-type-properties',
    },
    schema: [],
    messages: {
      unusedProperties:
        "Property '{{propertyName}}' is defined in type '{{typeName}}' but is not used in the destructuring. " +
        'Remove it from the destructuring pattern or use Omit<{{typeName}}, "{{propertyName}}"> to explicitly exclude it.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const ast = sourceCode.ast;

    if (!isProgram(ast)) {
      return {};
    }

    const program: TSESTree.Program = ast;

    function findTypeDeclaration(
      typeName: string,
    ): TSESTree.TSTypeAliasDeclaration | TSESTree.TSInterfaceDeclaration | undefined {
      for (const statement of program.body) {
        const declaration = isExportNamedDeclaration(statement) && statement.declaration
          ? statement.declaration
          : statement;

        if (
          isNamedTypeDeclaration(declaration)
          && declaration.id.type === AST_NODE_TYPES.Identifier
          && declaration.id.name === typeName
        ) {
          return declaration;
        }
      }

      return undefined;
    }

    function checkDestructuredProperties(
      objectPattern: TSESTree.ObjectPattern,
      typeAnnotation: TSESTree.TSTypeAnnotation,
      typeName: string,
    ): void {
      if (objectPattern.properties.some(p => p.type === AST_NODE_TYPES.RestElement)) {
        return;
      }

      const destructuredKeys = new Set(
        objectPattern.properties
          .filter(isProperty)
          .map(p => (p.key.type === AST_NODE_TYPES.Identifier ? p.key.name : null))
          .filter((k): k is string => k !== null),
      );

      let members: TSESTree.TypeElement[] = [];

      if (typeAnnotation.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference) {
        const ref = typeAnnotation.typeAnnotation;
        if (ref.typeName.type !== AST_NODE_TYPES.Identifier) return;

        const decl = findTypeDeclaration(ref.typeName.name);
        if (!decl) return;

        if (decl.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
          if (decl.typeAnnotation.type !== AST_NODE_TYPES.TSTypeLiteral) return;
          members = decl.typeAnnotation.members;
        } else if (decl.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
          members = decl.body.body;
        }
      } else if (typeAnnotation.typeAnnotation.type === AST_NODE_TYPES.TSTypeLiteral) {
        members = typeAnnotation.typeAnnotation.members;
      } else {
        return;
      }

      for (const member of members) {
        if (member.type !== AST_NODE_TYPES.TSPropertySignature) continue;
        if (member.key.type !== AST_NODE_TYPES.Identifier) continue;

        const propName = member.key.name;

        if (destructuredKeys.has(propName)) {
          const matchingProp = objectPattern.properties.find(
            p =>
              isProperty(p) &&
              p.key.type === AST_NODE_TYPES.Identifier &&
              p.key.name === propName,
          );

          if (
            matchingProp &&
            matchingProp.value &&
            matchingProp.value.type === AST_NODE_TYPES.ObjectPattern &&
            member.typeAnnotation
          ) {
            checkDestructuredProperties(
              matchingProp.value,
              member.typeAnnotation,
              `${typeName}.${propName}`,
            );
          }
          continue;
        }

        context.report({
          node: objectPattern,
          messageId: 'unusedProperties',
          data: {
            propertyName: propName,
            typeName,
          },
        });
      }
    }

    function checkParameter(param: unknown): void {
      if (!isObjectPattern(param) || !param.typeAnnotation) {
        return;
      }

      const typeAnn = param.typeAnnotation;

      let typeName = '(inline type)';

      if (typeAnn.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference) {
        const typeNameNode = typeAnn.typeAnnotation.typeName;
        if (typeNameNode.type === AST_NODE_TYPES.Identifier) {
          typeName = typeNameNode.name;
        }
      }

      checkDestructuredProperties(param, typeAnn, typeName);
    }

    return {
      FunctionDeclaration(node) {
        node.params.forEach(checkParameter);
      },
      ArrowFunctionExpression(node) {
        node.params.forEach(checkParameter);
      },
      FunctionExpression(node) {
        node.params.forEach(checkParameter);
      },
    };
  },
};
