/**
 * @license
 * Copyright 2016 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as Lint from "tslint";
import { isJsxAttribute, isJsxElement, isJsxClosingElement, isJsxOpeningElement, isJsxSelfClosingElement } from "tsutils";
import * as ts from "typescript";
import { getDeleteFixForSpaceBetweenTokens } from "../utils";

const OPTION_ALWAYS = "always";
const OPTION_NEVER = "never";
const OPTION_ALLOW = "allow";
const OPTION_ALLOW_MULTILINE = "allow-multiline";
const SPACING_VALUES = [OPTION_ALWAYS, OPTION_NEVER, OPTION_ALLOW];
type SPACING_TYPE = "always" | "never" | "allow";
const SPACING_OBJECT = {
    enum: SPACING_VALUES,
    type: "string",
};

interface IRuleOptions {
    closingSlash: SPACING_TYPE;
    beforeSelfClosing: SPACING_TYPE;
    afterOpening: SPACING_TYPE | "allow-multiline";
    beforeClosing: SPACING_TYPE;
}

export class Rule extends Lint.Rules.AbstractRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "jsx-tag-spacing",
        description: "Validate whitespace in and around the JSX opening and closing brackets",
        optionsDescription: Lint.Utils.dedent`
            This takes an object with four properties that control spacing of jsx element tags:

            * \`closingSlash\`: spacing around \`</\` and \`/>\`
            * \`beforeSelfClosing\`: spacing before the bracket of a self-closing tag
            * \`afterOpening\`: spacing after the opening tag bracket
            * \`beforeClosing\`: spacing before the closing tag bracket`,
        options: {
            type: "object",
            properties: {
                closingSlash: SPACING_OBJECT,
                beforeSelfClosing: SPACING_OBJECT,
                afterOpening: {
                    ...SPACING_OBJECT,
                    enum: [...SPACING_VALUES, OPTION_ALLOW_MULTILINE],
                },
                beforeClosing: SPACING_OBJECT,
            },
            additionalProperties: false,
        },
        optionExamples: [
            `[true, "${OPTION_NEVER}", "${OPTION_ALWAYS}", "${OPTION_NEVER}", "${OPTION_ALLOW}"]`,
            `[true, "${OPTION_ALLOW}", "${OPTION_NEVER}", "${OPTION_ALLOW_MULTILINE}", "${OPTION_NEVER}"]`,
        ],
        type: "style",
        typescriptOnly: true,
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FAILURE_SELF_CLOSING_NEVER = "Whitespace is forbidden between the `/` and `>`; write `/>`";
    public static FAILURE_SELF_CLOSING_ALWAYS = "Whitespace is required between the `/` and `>`; write `/ >`";
    public static FAILURE_CLOSING_NEVER = "Whitespace is forbidden between `<` and `/`; write `</`";
    public static FAILURE_CLOSING_ALWAYS = "Whitespace is required between `<` and `/`; write `< /`";
    public static FAILURE_BEFORE_SELF_CLOSING_NEVER = "A space is forbidden before closing brakcet";
    public static FAILURE_BEFORE_SELF_CLOSING_ALWAYS = "A space is required before closing brakcet";
    public static FAILURE_AFTER_OPENING_NEVER = "A space is forbidden before opening brakcet";
    public static FAILURE_AFTER_OPENING_ALWAYS = "A space is required before opening brakcet";
    public static FAILURE_BEFORE_CLOSING_NEVER = "A space is forbidden before closing bracket";
    public static FAILURE_BEFORE_CLOSING_ALWAYS = "Whitespace is required before closing brakcet";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        const option = Array.isArray(this.ruleArguments) ? this.ruleArguments[0] : undefined;
        return this.applyWithFunction(sourceFile, walk, option);
    }
}

function walk(ctx: Lint.WalkContext<IRuleOptions>): void {
    return ts.forEachChild(ctx.sourceFile, function cb(node: ts.Node): void {
        if (isJsxOpeningElement(node)) {
            if (ctx.options.closingSlash !== OPTION_ALLOW && isJsxSelfClosingElement(node)) {
                validateClosingSlash(ctx, node, ctx.options.closingSlash);
            }
            if (ctx.options.afterOpening !== OPTION_ALLOW) {
                validateAfterOpening(ctx, node, ctx.options.afterOpening);
            }
            if (ctx.options.beforeSelfClosing !== OPTION_ALLOW && isJsxSelfClosingElement(node)) {
                validateBeforeSelfClosing(ctx, node, ctx.options.beforeSelfClosing);
            }
            if (ctx.options.beforeClosing !== OPTION_ALLOW) {
                validateBeforeClosing(ctx, node, ctx.options.beforeClosing);
            }
        }
        if (isJsxClosingElement(node)) {
            if (ctx.options.afterOpening !== OPTION_ALLOW) {
                validateAfterOpening(ctx, node, ctx.options.afterOpening);
            }
            if (ctx.options.closingSlash !== OPTION_ALLOW) {
                validateClosingSlash(ctx, node, ctx.options.closingSlash);
            }
            if (ctx.options.beforeClosing !== OPTION_ALLOW) {
                validateBeforeClosing(ctx, node, ctx.options.beforeClosing);
            }
        }
        return ts.forEachChild(node, cb);
    });
}

function validateClosingSlash(ctx: Lint.WalkContext<IRuleOptions>, node: ts.Node, option: string) {
    if (isJsxSelfClosingElement(node)) {
        const lastTokens = [node.getLastToken(), node.getChildAt(node.getChildCount() - 2)];
        const fix = getDeleteFixForSpaceBetweenTokens(lastTokens[0], lastTokens[1]);

        if (option === OPTION_NEVER && fix !== undefined) {
            ctx.addFailureAt(node.getStart(), 1, Rule.FAILURE_SELF_CLOSING_NEVER, fix);
        } else if (option === OPTION_ALWAYS && fix === undefined) {
            const addFix = Lint.Replacement.appendText(lastTokens[1].getFullStart(), " ");
            ctx.addFailureAt(node.getStart(), 1, Rule.FAILURE_SELF_CLOSING_ALWAYS, addFix);
        }
    } else {
        const firstTokens = [node.getFirstToken(), node.getChildAt(1)];
        const fix = getDeleteFixForSpaceBetweenTokens(firstTokens[0], firstTokens[1]);

        if (option === OPTION_NEVER && fix !== undefined) {
            ctx.addFailureAt(node.getStart(), 1, Rule.FAILURE_CLOSING_NEVER, fix);
        } else if (option === OPTION_ALLOW && fix === undefined) {
            const addFix = Lint.Replacement.appendText(firstTokens[1].getFullStart(), " ");
            ctx.addFailureAt(node.getStart(), 1, Rule.FAILURE_CLOSING_ALWAYS, addFix);
        }
    }
}

function validateBeforeSelfClosing(ctx: Lint.WalkContext<IRuleOptions>, node: ts.Node, option: string) {
    if (isJsxOpeningElement(node)) {
        const attributes = node.attributes;
        const tokenBeforeClosingBracket = attributes.getChildCount() === 0 ? node.tagName : attributes.getChildAt(attributes.getChildCount() - 1);
        const closingSlash = ctx.sourceFile.kind
    }
}
