// Build identity, injected by Vite. See the "Build identity" comment in
// vite.config.js for why the commit hash, rather than the version, is what the
// UI leads with.
//
// `__BUILD_INFO__` is textually replaced with an object literal at build time.
// The `typeof` guard makes this module importable from somewhere that has no
// `define` -- a plain `node` import, a REPL -- where a bare reference would
// throw a ReferenceError instead of degrading to "dev".
export const BUILD_INFO =
  typeof __BUILD_INFO__ === 'undefined'
    ? {
        version: 'dev',
        sha: '',
        shortSha: 'dev',
        branch: '',
        build: '',
        builtAt: '',
        dirty: false,
      }
    : __BUILD_INFO__;

export const REPO_URL = 'https://github.com/Brandon-Yip2/genshin-pull-calculator';

// The compact line under the footer: the commit hash, which is what actually
// identifies the deploy, next to the human-readable version and build number.
export function buildLabel(info = BUILD_INFO) {
  const parts = [`v${info.version}`];
  if (info.build) parts.push(`build ${info.build}`);
  parts.push(info.shortSha || 'dev');
  return parts.join(' \u00b7 ');
}

// The full detail, revealed on hover so the footer line can stay one quiet row.
export function buildTitle(info = BUILD_INFO) {
  const lines = [
    info.sha ? `Commit ${info.sha}` : 'Unknown commit (built outside git)',
  ];
  if (info.branch) lines.push(`Branch ${info.branch}`);
  if (info.builtAt) lines.push(`Built ${new Date(info.builtAt).toLocaleString()}`);
  if (info.dirty) lines.push('Working tree had uncommitted changes');
  return lines.join('\n');
}

// The commit this build came from, so the badge can link straight to it.
export function buildCommitUrl(info = BUILD_INFO) {
  return info.sha ? `${REPO_URL}/commit/${info.sha}` : REPO_URL;
}
