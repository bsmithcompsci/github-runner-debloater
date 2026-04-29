# github-runner-debloater

> **Reclaim disk space on GitHub-hosted ubuntu runners by removing the pre-installed tools your project doesn't need.**

GitHub's `ubuntu-latest` runner ships with a large collection of compilers, runtimes, and SDKs (Node, Python, Go, Java, .NET, Android SDK, …). If your project only needs one or two of them, the rest is wasted space. This action lets you declare what you need; everything else is removed.

---

## Usage

```yaml
- name: Free up disk space
  uses: bsmithcompsci/github-runner-debloater@v1
  with:
    enable_node: 'true'   # keep Node.js; remove everything else
```

### All defaults (maximum cleanup)

```yaml
- name: Free up disk space
  uses: bsmithcompsci/github-runner-debloater@v1
  # All enable_* inputs default to 'false' → every supported tool is removed.
```

---

## Inputs

| Input | Default | Description |
|---|---|---|
| `enable_dotnet` | `false` | Keep .NET SDK / runtime |
| `enable_android` | `false` | Keep Android SDK |
| `enable_ghc` | `false` | Keep GHC Haskell compiler (ghc, ghcup) |
| `enable_swift` | `false` | Keep Swift compiler |
| `enable_java` | `false` | Keep Java JVM |
| `enable_node` | `false` | Keep Node.js |
| `enable_python` | `false` | Keep base Python toolchain cache — **root for all Python add-ons below** |
| `enable_miniconda` | `false` | Keep Miniconda (**requires `enable_python: 'true'`**) |
| `enable_pipx` | `false` | Keep pipx (**requires `enable_python: 'true'`**) |
| `enable_pypy` | `false` | Keep PyPy runtime (**requires `enable_python: 'true'`**) |
| `enable_ruby` | `false` | Keep Ruby |
| `enable_go` | `false` | Keep Go toolchain |
| `enable_google` | `false` | Keep Google tools (Google Cloud SDK, /opt/google) — **root for Chromium** |
| `enable_chromium` | `false` | Keep Chromium browser (**requires `enable_google: 'true'`**) |
| `enable_microsoft` | `false` | Keep Microsoft tools (/opt/microsoft) |
| `enable_azure` | `false` | Keep Azure CLI |
| `enable_powershell` | `false` | Keep PowerShell |
| `enable_julia` | `false` | Keep Julia |
| `enable_codeql` | `false` | Keep CodeQL |
| `enable_docker` | `false` | Keep Docker images (skip `docker system prune -af`) |

---

## Cross-dependency rules

Some tools depend on others being present on the runner. The action validates inputs before performing any removal and exits with a descriptive error if a violation is detected.

| Input | Requires |
|---|---|
| `enable_miniconda: 'true'` | `enable_python: 'true'` |
| `enable_pipx: 'true'` | `enable_python: 'true'` |
| `enable_pypy: 'true'` | `enable_python: 'true'` |
| `enable_chromium: 'true'` | `enable_google: 'true'` |

**Example errors**

```
Error: enable_miniconda=true requires enable_python=true.
Miniconda is a Python distribution and depends on the base Python toolchain.

Error: enable_chromium=true requires enable_google=true.
Chromium is a Google product and its tooling lives inside
/opt/google and /usr/lib/google-cloud-sdk.
```

---

## Examples

### C++ / CMake project

```yaml
- uses: bsmithcompsci/github-runner-debloater@v1
  # nothing enabled → all pre-installed runtimes removed
```

### Node.js project

```yaml
- uses: bsmithcompsci/github-runner-debloater@v1
  with:
    enable_node: 'true'
```

### Python project (base only)

```yaml
- uses: bsmithcompsci/github-runner-debloater@v1
  with:
    enable_python: 'true'
```

### Python project with Miniconda and pipx

```yaml
- uses: bsmithcompsci/github-runner-debloater@v1
  with:
    enable_python: 'true'
    enable_miniconda: 'true'
    enable_pipx: 'true'
```

### Go project

```yaml
- uses: bsmithcompsci/github-runner-debloater@v1
  with:
    enable_go: 'true'
```

### .NET project

```yaml
- uses: bsmithcompsci/github-runner-debloater@v1
  with:
    enable_dotnet: 'true'
```

### Browser / Playwright project (Chromium + Google tools)

```yaml
- uses: bsmithcompsci/github-runner-debloater@v1
  with:
    enable_google: 'true'
    enable_chromium: 'true'
```

---

## Disk-space baseline

After a full cleanup (all defaults) the action is expected to leave at least **19 GB free (≥ 26 % of the total drive)** on `ubuntu-latest`. This baseline is stored in [`metrics/baseline.json`](metrics/baseline.json) and enforced by the PR CI.

---

## CI workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| [`pull_request_ci.yml`](.github/workflows/pull_request_ci.yml) | PR → `main` | Validate action with actionlint; run scenario tests; enforce disk-space baseline |
| [`release_ci.yml`](.github/workflows/release_ci.yml) | Push → `main` | Auto-bump semver patch tag; create a GitHub Release |

---

## License

MIT — see [LICENSE](LICENSE).
