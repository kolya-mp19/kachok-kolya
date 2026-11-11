import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import assert from 'node:assert/strict';

class LocalServer {
  #output = '';
  #process;

  constructor({ arguments_, port, cwd }) {
    this.origin = `http://127.0.0.1:${port}`;
    this.#process = spawn(process.execPath, arguments_, {
      cwd,
      env: { ...process.env, PORT: String(port) },
      stdio: 'pipe',
    });
    this.#process.stdout.on('data', (chunk) => {
      this.#output += chunk;
    });
    this.#process.stderr.on('data', (chunk) => {
      this.#output += chunk;
    });
  }

  async waitUntilReady(healthPath) {
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(this.#process.exitCode, null, this.#output);

      try {
        if ((await fetch(this.origin + healthPath)).ok) {
          return;
        }
      } catch {
        // TCP отказывает, пока дочерний процесс запускается. Это ожидаемо только
        // в ограниченном ожидании готовности, а не при проверке самого HTTP-сценария.
      }

      await setTimeout(100);
    }

    assert.fail(`Локальный сервер не запустился: ${this.#output}`);
  }

  async stop() {
    if (this.#process.exitCode === null && this.#process.signalCode === null) {
      const exited = once(this.#process, 'exit');
      this.#process.kill();
      await exited;
    }
  }
}

/** Каждый тест владеет своим процессом; отказ запуска также обязан освободить порт. */
export async function startLocalServer({ arguments_, port, cwd, healthPath = '/' }) {
  const server = new LocalServer({ arguments_, port, cwd });

  try {
    await server.waitUntilReady(healthPath);
    return server;
  } catch (error) {
    await server.stop();
    throw error;
  }
}
