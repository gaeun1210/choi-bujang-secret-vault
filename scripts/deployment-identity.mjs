const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const REPO = /^[A-Za-z0-9._-]{1,100}$/u;
const SHA = /^[a-f0-9]{40}$/iu;
const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/iu;

export function deploymentIdentity(env, config) {
  const owner = env.VERCEL_GIT_REPO_OWNER;
  const repo = env.VERCEL_GIT_REPO_SLUG;
  const commit = env.VERCEL_GIT_COMMIT_SHA;
  const host = env.VERCEL_URL;
  if (env.VERCEL_GIT_PROVIDER !== 'github' || !OWNER.test(owner || '')
      || !REPO.test(repo || '') || repo === '.' || repo === '..'
      || repo.toLowerCase().endsWith('.git') || !SHA.test(commit || '')
      || !HOST.test(host || '') || !Number.isInteger(config?.step)
      || config.step < 1 || config.step > 12
      || typeof config.judgeIssuer !== 'string'
      || !/^https:\/\/[a-z0-9-]+\.up\.railway\.app\/defense\/judge$/iu.test(config.judgeIssuer)
      || typeof config.sampleMarker !== 'string'
      || !/^[A-Z0-9_]{1,80}$/u.test(config.sampleMarker)) {
    throw new Error('배포 식별 정보를 확인할 수 없습니다. Vercel 시스템 환경변수와 aleph.config.json을 확인하세요.');
  }
  // 3단계부터: 허용 경로와 원본 API 주소를 공개 식별 정보에 함께 싣습니다 (비밀값 아님).
  const routes = Array.isArray(config.allowedRoutes)
    ? config.allowedRoutes.filter(route => typeof route === 'string'
      && /^(GET|POST|PUT|PATCH|DELETE) \/[A-Za-z0-9/_:.-]{0,200}$/u.test(route))
    : [];
  const extra = {};
  if (routes.length) extra.allowedRoutes = routes;
  if (typeof config.originalApiUrl === 'string' && /^https:\/\/[^\s?#]+$/u.test(config.originalApiUrl)) {
    extra.originalApiUrl = config.originalApiUrl;
  }
  if (typeof config.restoreRoute === 'string' && /^POST \/[A-Za-z0-9/_:.-]{1,200}$/u.test(config.restoreRoute)) {
    extra.restoreRoute = config.restoreRoute;
  }
  return {
    schema: 'aleph.defense.deployment.v1',
    step: config.step,
    repoUrl: `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`,
    commit: commit.toLowerCase(),
    publicAppUrl: `https://${host.toLowerCase()}`,
    judgeIssuer: config.judgeIssuer,
    sampleMarker: config.sampleMarker,
    ...extra,
  };
}
