import { ESLintUtils } from '@typescript-eslint/utils';
import type { ESLintPluginDocs } from '../types';
export declare const createRule: <Options extends readonly unknown[], MessageIds extends string>({ meta, name, ...rule }: Readonly<ESLintUtils.RuleWithMetaAndName<Options, MessageIds, ESLintPluginDocs>>) => ESLintUtils.RuleModule<MessageIds, Options, ESLintPluginDocs, ESLintUtils.RuleListener> & {
    name: string;
};
//# sourceMappingURL=create-rule.d.ts.map