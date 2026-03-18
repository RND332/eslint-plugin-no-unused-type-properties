import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types';
import { createRule } from '../utils/create-rule'; // assuming this is ESLintUtils.RuleCreator wrapped

type MessageIds = 'unusedProperties';

export const noUnusedTypePropertiesRule = createRule<[], MessageIds>({
  name: 'no-unused-type-properties', // optional but recommended
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
    // No need for explicit Readonly<…> — generics infer it correctly

    const sourceCode = context.sourceCode;

    function isProperty(
      prop: TSESTree.Property | TSESTree.RestElement,
    ): prop is TSESTree.Property {
      return prop.type === AST_NODE_TYPES.Property;
    }

    function findTypeDeclaration(
      typeName: string,
    ): TSESTree.TSTypeAliasDeclaration | TSESTree.TSInterfaceDeclaration | undefined {
      for (const stmt of sourceCode.ast.body) {
        let decl: TSESTree.Node | undefined;

        if (stmt.type === AST_NODE_TYPES.ExportNamedDeclaration && stmt.declaration) {
          decl = stmt.declaration;
        } else {
          decl = stmt;
        }

        if (
          decl.type === AST_NODE_TYPES.TSTypeAliasDeclaration &&
          decl.id.type === AST_NODE_TYPES.Identifier &&
          decl.id.name === typeName
        ) {
          return decl;
        }

        if (
          decl.type === AST_NODE_TYPES.TSInterfaceDeclaration &&
          decl.id.type === AST_NODE_TYPES.Identifier &&
          decl.id.name === typeName
        ) {
          return decl;
        }
      }
      return undefined;
    }

    function checkDestructuredProperties(
      objectPattern: TSESTree.ObjectPattern,
      typeAnnotation: TSESTree.TSTypeAnnotation,
      typeName: string,
    ): void {
      // Skip if rest element (...rest) is present — assumes it can catch anything
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

        // Skip if already destructured
        if (destructuredKeys.has(propName)) {
          // Optional: recurse into nested patterns
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

        // Report the unused property
        context.report({
          node: objectPattern,
          // Better: point roughly at the parameter location
          // Could be improved further by locating the type reference node
          messageId: 'unusedProperties',
          data: {
            propertyName: propName,
            typeName,
          },
        });
      }
    }

    function checkParameter(param: TSESTree.Parameter): void {
      if (param.type !== AST_NODE_TYPES.ObjectPattern) return;
      if (!param.typeAnnotation) return;

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
      // Optional: add ObjectMethod, etc. if you want method params too
    };
  },
});
