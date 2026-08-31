/**
 * Build a signed Android App Bundle. Requires android/keystore.properties and
 * the JKS it points at — neither file is committed (see keystore.properties.example).
 *
 * Usage: npm run android:aab
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const androidDir = path.resolve('android');
const propsPath = path.join(androidDir, 'keystore.properties');

if (!existsSync(propsPath)) {
  console.error(
    'Missing android/keystore.properties.\n' +
      'Copy android/keystore.properties.example, generate upload-keystore.jks with keytool,\n' +
      'and keep both files out of git.',
  );
  process.exit(1);
}

const props = Object.fromEntries(
  readFileSync(propsPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const storeFile = props.storeFile
  ? path.resolve(androidDir, props.storeFile)
  : '';
if (!storeFile || !existsSync(storeFile)) {
  console.error(`Keystore file not found: ${storeFile || '(storeFile unset)'}`);
  process.exit(1);
}

const isWin = process.platform === 'win32';
const result = spawnSync(isWin ? 'gradlew.bat' : './gradlew', ['bundleRelease'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWin,
  env: {
    ...process.env,
    JAVA_HOME: defaultJavaHome() || process.env.JAVA_HOME,
  },
});

if ((result.status ?? 1) === 0) {
  const aab = path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  console.log(existsSync(aab) ? `Signed AAB: ${aab}` : 'bundleRelease finished; locate the .aab under android/app/build/outputs/bundle/release/');
}

process.exit(result.status ?? 1);

function javaMajor(home) {
  try {
    const release = readFileSync(path.join(home, 'release'), 'utf8');
    const match = release.match(/JAVA_VERSION="(\d+)/);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

function hasJava(home) {
  return existsSync(path.join(home, 'bin', 'java.exe')) || existsSync(path.join(home, 'bin', 'java'));
}

/** AGP 8.13 / Gradle 8.14 want JDK 17–21. Android Studio's bundled JBR is currently 25. */
function defaultJavaHome() {
  const candidates = [
    process.env.JAVA_HOME,
    'C:\\Program Files\\Java\\jdk-21.0.12',
    'C:\\Program Files\\Java\\jdk-21',
    'C:\\Program Files\\Microsoft\\jdk-21.0.12-hotspot',
    path.join('C:', 'Program Files', 'Android', 'Android Studio', 'jbr'),
  ].filter(Boolean);

  const compatible = candidates.find((home) => {
    if (!hasJava(home)) return false;
    const major = javaMajor(home);
    return major === 0 || (major >= 17 && major <= 21);
  });
  return compatible || process.env.JAVA_HOME;
}
