import { mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("数据库备份失败：DATABASE_URL 未配置，无法连接数据库");
  }
  return url;
}

function runCommand(
  command: string,
  args: string[],
  options?: {
    input?: string;
  },
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || `${command} exited with code ${code}`));
    });

    if (options?.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });
}

export async function createDatabaseBackupSql() {
  const databaseUrl = getDatabaseUrl();
  const { stdout } = await runCommand("pg_dump", [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    databaseUrl,
  ]);

  return stdout;
}

export async function restoreDatabaseBackupSql(sql: string) {
  if (!sql.trim()) {
    throw new Error("备份内容不能为空");
  }

  const databaseUrl = getDatabaseUrl();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jboard-restore-"));
  const filePath = path.join(tempDir, "restore.sql");

  try {
    await writeFile(filePath, sql, "utf8");
    await runCommand("psql", [
      databaseUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      filePath,
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function restoreDatabaseBackupFile(file: File) {
  const sql = Buffer.from(await file.arrayBuffer()).toString("utf8");
  if (!sql) {
    throw new Error("无法读取备份文件");
  }

  await restoreDatabaseBackupSql(sql);
}
