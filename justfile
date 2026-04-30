# https://just.systems

set dotenv-load := true
set dotenv-filename := ".env.local"
set shell := ["bash", "-euo", "pipefail", "-c"]
set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"]

app_id := "3550962"
installation_id := "128270682"
owner := "bsmithcompsci"
repo := "github-runner-debloater"
test_tag := "v0.0.999-app-token-local-test"

default:
    @just --list

test-app-tag tag=test_tag sha="HEAD":
    @node scripts/github-tag-refs.mjs --mode test-app-token --app-id "{{ app_id }}" --installation-id "{{ installation_id }}" --owner "{{ owner }}" --repo "{{ repo }}" --tag "{{ tag }}" --sha "{{ sha }}"
