import { mkdir, writeFile, readFile } from "node:fs/promises";
import { Profiler, Session } from "node:inspector/promises";
import { join, resolve } from "node:path";

// @ts-ignore
import CpuPro from "cpupro";

export interface CpuProfilerOptionsProps {
  filename?: string;
  output?: string;
  generateHtml?: boolean;
  autoHooks?: boolean;
  signals?: NodeJS.Signals[];
}

export class CpuProfiler {
  private session: Session;
  private isRunning: boolean;
  private filename: string;
  private output: string;
  private generateHtml: boolean;

  constructor(options: CpuProfilerOptionsProps = {}) {
    this.session = new Session();
    this.isRunning = false;
    this.filename = options.filename ?? "cpu-profile";
    this.output = options.output ?? "node-profiling-toolkit";
    this.generateHtml = options.generateHtml ?? false;

    if (options.autoHooks !== false) {
      const defaultSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];

      this.registerShutdownHooks(options.signals ?? defaultSignals);
    }
  }

  private registerShutdownHooks(signals: NodeJS.Signals[]) {
    signals.forEach((signal) => {
      process.once(signal, async () => {
        await this.stop();
        process.exit(0);
      });
    });
  }

  private async prepareHtmlReport(
    profile: Profiler.Profile,
    cpuProfilerName: string,
    directory: string
  ) {
    const baseName = cpuProfilerName.split(".")[0];
    const htmlPath = `${directory}/html/${baseName}.html`;

    const report = CpuPro.createReport(profile);

    await mkdir(`${directory}/html`, { recursive: true });
    report.writeToFile(htmlPath);

    let html = await readFile(htmlPath, "utf-8");
    html = html.replace("Untitled profile", `${baseName}`);
    html = html.replace(`data:"model.data"`, `data:"../${cpuProfilerName}"`);

    await writeFile(htmlPath, html, "utf-8");
  }

  async start() {
    if (this.isRunning) return;

    this.session.connect();

    await this.session.post("Profiler.enable");
    await this.session.post("Profiler.start");

    this.isRunning = true;
  }

  async stop() {
    if (!this.isRunning) return;

    const { profile } = await this.session.post("Profiler.stop");

    const directory = resolve(this.output);
    const cpuProfilerName = `${this.filename}-${Date.now()}.cpuprofile`;
    const profilePath = join(directory, cpuProfilerName);

    await mkdir(directory, { recursive: true });
    await writeFile(profilePath, JSON.stringify(profile));

    if (this.generateHtml) {
      await this.prepareHtmlReport(profile, cpuProfilerName, directory);
    }

    this.session.disconnect();
    this.isRunning = false;
  }
}
