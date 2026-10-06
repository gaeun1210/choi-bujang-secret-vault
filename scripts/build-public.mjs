import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
if (!Number.isInteger(config.step) || config.step < 2) {
  throw new Error('2단계부터는 메모를 정적 파일로 복사하지 않습니다. aleph.config.json의 step을 확인하세요.');
}

// 2단계: 메모는 서버 함수(api/notes.js)가 학습용 DB에서 읽습니다.
// 정적 결과물에 메모 파일이 다시 생기면 공개되므로 빌드를 멈춥니다.
for (const name of ['data.json']) {
  const exposed = await access(resolve(root, 'public', name)).then(() => true, () => false);
  if (exposed) {
    throw new Error(`public/${name}이 다시 생겼습니다. 메모를 정적 파일로 공개하지 마세요.`);
  }
}
await mkdir(resolve(root, 'public'), { recursive: true });
console.log('정적 결과물에 메모 파일이 없음을 확인했습니다.');

if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(root, 'public', 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
