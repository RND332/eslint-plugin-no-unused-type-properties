import { noUnusedTypePropertiesRule } from './rules/no-unused-type-properties';
export const rules = {
    'no-unused-type-properties': noUnusedTypePropertiesRule,
};
const plugin = {
    rules,
};
export default plugin;
