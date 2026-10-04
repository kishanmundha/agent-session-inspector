import { spawn } from "child_process";
import path from "path";
import { statOf } from "@/lib/providers/fs-utils";

/** The file manager command that shows `target`: a folder opened, a file selected. */
function command(target: string, isDirectory: boolean): [string, string[]] {
  if (process.platform === "darwin") return ["open", isDirectory ? [target] : ["-R", target]];
  if (process.platform === "win32") {
    return ["explorer.exe", [isDirectory ? target : `/select,${target}`]];
  }
  return ["xdg-open", [isDirectory ? target : path.dirname(target)]];
}

/**
 * Shows a path in the file manager of the machine the server runs on. False
 * when the path is gone or there is no file manager to launch (a container,
 * a headless host).
 */
export function revealInFileManager(target: string): Promise<boolean> {
  const stat = statOf(target);
  if (!stat) return Promise.resolve(false);
  const [bin, args] = command(target, stat.isDirectory());
  return new Promise((resolve) => {
    const child = spawn(bin, args, { detached: true, stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}
