/* eslint-disable unicorn/no-array-callback-reference */
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { createRule } from '../utils/create-rule';
function isProperty(property) {
    return property.type === AST_NODE_TYPES.Property;
}
function isObjectPattern(param) {
    return param.type === AST_NODE_TYPES.ObjectPattern;
}
function isTypeAliasDeclaration(item) {
    return item.type === AST_NODE_TYPES.TSTypeAliasDeclaration;
}
function getTypeAliasDeclaration(item) {
    if (isTypeAliasDeclaration(item)) {
        return item;
    }
    if (item.type === AST_NODE_TYPES.ExportNamedDeclaration &&
        item.declaration &&
        item.declaration.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
        return item.declaration;
    }
    return undefined;
}
function isInterfaceDeclaration(item) {
    return item.type === AST_NODE_TYPES.TSInterfaceDeclaration;
}
function getInterfaceDeclaration(item) {
    if (isInterfaceDeclaration(item)) {
        return item;
    }
    if (item.type === AST_NODE_TYPES.ExportNamedDeclaration &&
        item.declaration &&
        item.declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
        return item.declaration;
    }
    return undefined;
}
export const noUnusedTypePropertiesRule = createRule({
    name: 'no-unused-type-properties',
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallows unused type properties for destructured function arguments',
            recommended: false,
            requiresTypeChecking: false,
        },
        messages: {
            unusedProperties: "Property '{{propertyName}}' is defined in type '{{typeName}}' but is not used in the destructuring. Remove it or use Omit<{{typeName}}, '{{propertyName}}'> to explicitly exclude it.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const checkIfPropertyIsPresent = (objectPattern, typeName) => (typeProperty) => {
            if (typeProperty.type !== AST_NODE_TYPES.TSPropertySignature) {
                return;
            }
            if (typeProperty.key.type !== AST_NODE_TYPES.Identifier) {
                return;
            }
            const propertyName = typeProperty.key.name;
            const properties = objectPattern.properties.filter(isProperty);
            const property = properties.find(property => property.key.type === AST_NODE_TYPES.Identifier && property.key.name === propertyName);
            if (!property) {
                context.report({
                    node: objectPattern,
                    messageId: 'unusedProperties',
                    data: {
                        propertyName,
                        typeName,
                    },
                });
                return;
            }
            if (typeProperty.typeAnnotation && property.value.type === AST_NODE_TYPES.ObjectPattern) {
                recursiveCheck(property.value, typeProperty.typeAnnotation);
            }
        };
        const recursiveCheck = (object, type) => {
            const restElement = object.properties.find(property => property.type === AST_NODE_TYPES.RestElement);
            if (restElement) {
                return;
            }
            if (type.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
                type.typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier) {
                const typeName = type.typeAnnotation.typeName.name;
                const typeDeclaration = context.sourceCode.ast.body
                    .map(getTypeAliasDeclaration)
                    .find((decl) => decl !== undefined && decl.id.name === typeName);
                if (typeDeclaration) {
                    if (typeDeclaration.typeAnnotation.type !== AST_NODE_TYPES.TSTypeLiteral) {
                        return;
                    }
                    typeDeclaration.typeAnnotation.members.forEach(checkIfPropertyIsPresent(object, typeName));
                    return;
                }
                const interfaceDeclaration = context.sourceCode.ast.body
                    .map(getInterfaceDeclaration)
                    .find((decl) => decl !== undefined && decl.id.name === typeName);
                if (!interfaceDeclaration) {
                    return;
                }
                interfaceDeclaration.body.body.forEach(checkIfPropertyIsPresent(object, typeName));
                return;
            }
            if (type.typeAnnotation.type === AST_NODE_TYPES.TSTypeLiteral) {
                const inlineTypeName = context.sourceCode.getText(type.typeAnnotation);
                type.typeAnnotation.members.forEach(checkIfPropertyIsPresent(object, inlineTypeName));
            }
        };
        const checkParameter = (paramObjectPattern) => {
            if (!paramObjectPattern.typeAnnotation) {
                return;
            }
            recursiveCheck(paramObjectPattern, paramObjectPattern.typeAnnotation);
        };
        return {
            FunctionDeclaration(node) {
                node.params.filter(isObjectPattern).forEach(checkParameter);
            },
            ArrowFunctionExpression(node) {
                node.params.filter(isObjectPattern).forEach(checkParameter);
            },
            FunctionExpression(node) {
                node.params.filter(isObjectPattern).forEach(checkParameter);
            },
        };
    },
});
