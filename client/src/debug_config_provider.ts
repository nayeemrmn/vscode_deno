// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as vscode from "vscode";
import type { DenoExtensionContext } from "./types";
import { getDenoCommandName, getInspectArg } from "./util";

export class DenoDebugConfigurationProvider
  implements vscode.DebugConfigurationProvider {
  #extensionContext: DenoExtensionContext;

  #getEnv() {
    const settings = this.#extensionContext.clientOptions
      .initializationOptions();
    const env: Record<string, string> = {};
    if (settings.cache) {
      env["DENO_DIR"] = settings.cache;
    }
    if (settings.future) {
      env["DENO_FUTURE"] = "1";
    }
    return env;
  }

  #getAdditionalRuntimeArgs() {
    const args: string[] = [];
    const settings = this.#extensionContext.clientOptions
      .initializationOptions();
    if (settings.unstable) {
      args.push("--unstable");
    }
    if (settings.importMap) {
      args.push("--import-map");
      args.push(settings.importMap.trim());
    }
    if (settings.config) {
      args.push("--config");
      args.push(settings.config.trim());
    }
    return args;
  }

  #getInspectArg() {
    return getInspectArg(this.#extensionContext.serverInfo?.version);
  }

  constructor(extensionContext: DenoExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  async provideDebugConfigurations(): Promise<vscode.DebugConfiguration[]> {
    return [
      {
        request: "launch",
        name: "Launch Program",
        type: "node",
        program: "${workspaceFolder}/main.ts",
        cwd: "${workspaceFolder}",
        env: this.#getEnv(),
        runtimeExecutable: await getDenoCommandName(),
        runtimeArgs: [
          "run",
          ...this.#getAdditionalRuntimeArgs(),
          this.#getInspectArg(),
          "--allow-all",
        ],
        attachSimplePort: 9229,
      },
    ];
  }

  async resolveDebugConfiguration(
    workspace: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): Promise<vscode.DebugConfiguration | null | undefined> {
    // if launch.json is missing or empty
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      const langId = editor?.document.languageId;
      if (
        editor &&
        (langId === "typescript" || langId === "javascript" ||
          langId === "typescriptreact" || langId === "javascriptreact")
      ) {
        // https://github.com/microsoft/vscode/issues/106703#issuecomment-694595773
        // Bypass the bug of the vscode 1.49.0
        vscode.debug.startDebugging(workspace, {
          request: "launch",
          name: "Launch Program",
          type: "node",
          program: "${file}",
          env: this.#getEnv(),
          runtimeExecutable: await getDenoCommandName(),
          runtimeArgs: [
            "run",
            ...this.#getAdditionalRuntimeArgs(),
            this.#getInspectArg(),
            "--allow-all",
          ],
          attachSimplePort: 9229,
        });
        return undefined;
      }
      return null;
    }

    if (!config.program) {
      await vscode.window.showErrorMessage("Cannot resolve a program to debug");
      return undefined;
    }

    return config;
  }
}
