import { mkdir, writeFile } from "node:fs/promises";
import { Session } from "node:inspector/promises";
import { resolve } from "node:path";

export interface CpuProfilerOptionsProps {
  output?: string;
}

export class CpuProfiler {
  private session: Session;
  private isRunning: boolean;
  private options: CpuProfilerOptionsProps;

  constructor(options: CpuProfilerOptionsProps) {
    this.session = new Session();
    this.isRunning = false;
    this.options = options ?? { output: "node-profiling" };
  }

  async start() {
    if (this.isRunning) return;

    this.session.connect();

    await this.session.post("Profiler.enable");
    await this.session.post("Profiler.start");

    this.isRunning = true;
  }

  async stop(filename = "cpu-profile") {
    if (!this.isRunning) return;

    const { profile } = await this.session.post("Profiler.stop");

    const profileName = `${filename}-${Date.now()}.cpuprofile`;
    const profilePath = `${this.options.output}/${profileName}`;

    await mkdir(resolve(this.options.output ?? "node-profiling"), {
      recursive: true,
    });

    await writeFile(profilePath, JSON.stringify(profile));

    this.session.disconnect();
    this.isRunning = false;
  }
}
