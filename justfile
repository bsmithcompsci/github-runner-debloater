# https://just.systems

set dotenv-load := true
set dotenv-filename := ".env.local"
set shell := ["bash", "-euo", "pipefail", "-c"]
set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"]

app_id := "3550962"
installation_id := "128270682"
owner := "bsmithcompsci"
repo := "github-runner-debloater"
floating_tags := "major,minor"

default:
    @just --list

publish tag="auto" sha="HEAD" floating=floating_tags:
    @node scripts/github-tag-refs.mjs --mode publish --floating-tags "{{ floating }}" --app-id "{{ app_id }}" --installation-id "{{ installation_id }}" --owner "{{ owner }}" --repo "{{ repo }}" --tag "{{ tag }}" --sha "{{ sha }}"
