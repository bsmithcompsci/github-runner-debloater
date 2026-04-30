import { execFileSync } from "node:child_process";
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    }

    args[key.slice(2)] = value;
  }

  return args;
}

function requireArg(args, key) {
  if (!args[key]) {
    throw new Error(`Missing --${key}`);
  }

  return args[key];
}

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

function resolveSha(sha) {
  if (!sha || sha === "HEAD") {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  }

  return sha;
}

function resolveRepo(args) {
  if (args.owner && args.repo) {
    return { owner: args.owner, repo: args.repo };
  }

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error("Missing --owner/--repo or GITHUB_REPOSITORY.");
  }

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY value: ${repository}`);
  }

  return { owner, repo };
}

async function request({ method, url, token, body }) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`${method} ${url} failed with HTTP ${response.status}: ${text}`);
    error.status = response.status;
    error.body = text;
    throw error;
  }

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

async function createJwt({ appId, privateKeyPath }) {
  const privateKey = await readFile(privateKeyPath, "utf8");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  }));
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");

  signer.update(unsignedToken);
  signer.end();

  return `${unsignedToken}.${base64Url(signer.sign(privateKey))}`;
}

async function getToken(args) {
  const existingToken = args.token ?? process.env.RELEASE_APP_TOKEN ?? process.env.GITHUB_TOKEN;
  if (existingToken) {
    return existingToken;
  }

  const appId = requireArg(args, "app-id");
  const installationId = requireArg(args, "installation-id");
  const privateKeyPath = args["private-key"] ?? process.env.PRIVATE_KEY_PATH;

  if (!privateKeyPath) {
    throw new Error("Missing --private-key or PRIVATE_KEY_PATH in the environment.");
  }

  const jwt = await createJwt({ appId, privateKeyPath });
  const tokenResponse = await request({
    method: "POST",
    url: `https://api.github.com/app/installations/${installationId}/access_tokens`,
    token: jwt,
  });

  if (!tokenResponse.token) {
    throw new Error("GitHub did not return an installation token.");
  }

  return tokenResponse.token;
}

function isMissingRef(error) {
  return error.status === 404 || error.body?.includes("Reference does not exist");
}

function isRulesetError(error) {
  return error.status === 422 && error.body?.includes("Repository rule violations");
}

function reportRulesetError({ error, fullRef, appId }) {
  if (!isRulesetError(error)) {
    return;
  }

  const appHint = appId
    ? ` with actor_type "Integration", actor_id "${appId}", and bypass_mode "always"`
    : "";
  console.error(`GitHub rejected ${fullRef}. Confirm every active ruleset targeting ${fullRef} has a bypass actor${appHint}.`);
}

class GitHubRefs {
  constructor({ owner, repo, token, appId }) {
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.appId = appId;
    this.baseUrl = `https://api.github.com/repos/${owner}/${repo}/git`;
  }

  async createTag(tag, sha) {
    const fullRef = `refs/tags/${tag}`;

    try {
      await request({
        method: "POST",
        url: `${this.baseUrl}/refs`,
        token: this.token,
        body: { ref: fullRef, sha },
      });
      console.log(`Created ${fullRef} at ${sha}`);
    } catch (error) {
      reportRulesetError({ error, fullRef, appId: this.appId });
      throw error;
    }
  }

  async deleteTagIfExists(tag) {
    const ref = `tags/${tag}`;
    const fullRef = `refs/${ref}`;

    try {
      await request({
        method: "DELETE",
        url: `${this.baseUrl}/refs/${encodeURIComponent(ref)}`,
        token: this.token,
      });
      console.log(`Deleted ${fullRef}`);
    } catch (error) {
      reportRulesetError({ error, fullRef, appId: this.appId });

      if (!isMissingRef(error)) {
        throw error;
      }

      console.log(`${fullRef} did not exist`);
    }
  }
}

function floatingTagsFor(tag) {
  const match = tag.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Expected semver tag like v1.2.3, got ${tag}`);
  }

  const [, major, minor] = match;
  return [`v${major}`, `v${major}.${minor}`];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = requireArg(args, "mode");
  const tag = requireArg(args, "tag");
  const sha = resolveSha(args.sha);
  const { owner, repo } = resolveRepo(args);
  const token = await getToken(args);
  const refs = new GitHubRefs({ owner, repo, token, appId: args["app-id"] });

  if (mode === "create-release-tag") {
    await refs.createTag(tag, sha);
    return;
  }

  if (mode === "refresh-floating-tags") {
    for (const floatingTag of floatingTagsFor(tag)) {
      await refs.deleteTagIfExists(floatingTag);
      await refs.createTag(floatingTag, sha);
    }
    return;
  }

  if (mode === "test-app-token") {
    console.log(`Testing GitHub App token against ${owner}/${repo}`);
    console.log(`Tag: ${tag}`);
    console.log(`Target SHA: ${sha}`);
    await refs.deleteTagIfExists(tag);
    await refs.createTag(tag, sha);
    await refs.deleteTagIfExists(tag);
    return;
  }

  throw new Error(`Unknown --mode ${mode}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
